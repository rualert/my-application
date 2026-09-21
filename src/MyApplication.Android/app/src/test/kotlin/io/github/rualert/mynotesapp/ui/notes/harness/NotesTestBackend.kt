package io.github.rualert.mynotesapp.ui.notes.harness

import io.github.rualert.mynotesapp.data.api.AuthApi
import io.github.rualert.mynotesapp.data.api.AuthResponse
import io.github.rualert.mynotesapp.data.api.HighlightedSegmentResponse
import io.github.rualert.mynotesapp.data.api.NoteResponse
import io.github.rualert.mynotesapp.data.api.NoteSearchResultResponse
import io.github.rualert.mynotesapp.data.api.NoteSummaryResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.api.UpdateNoteRequest
import androidx.room.Room
import io.github.rualert.mynotesapp.data.auth.AuthRepository
import io.github.rualert.mynotesapp.data.auth.CookieStorage
import io.github.rualert.mynotesapp.data.auth.SessionCookieJar
import io.github.rualert.mynotesapp.data.auth.SessionEndListener
import io.github.rualert.mynotesapp.data.auth.TokenStore
import io.github.rualert.mynotesapp.data.local.NotesDatabase
import io.github.rualert.mynotesapp.data.notes.NotesRepository
import io.github.rualert.mynotesapp.data.notes.NotesSyncer
import io.github.rualert.mynotesapp.data.notes.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.job
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import org.robolectric.RuntimeEnvironment
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.create
import java.io.IOException
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch

/**
 * Настоящий API заметок в миниатюре: хранит заметки в памяти и соблюдает
 * правило версий, поэтому `PUT` с устаревшей версией получает `409` — так же,
 * как от настоящего сервера.
 *
 * Подменяется только сеть: репозиторий, Retrofit, разбор ответов и хранилище
 * на устройстве в тестах настоящие (см. CLAUDE.md — то же правило, что у MSW
 * в вебе). Хранилище — Room в памяти, поэтому тесты идут под Robolectric.
 *
 * Отправка здесь происходит сразу, без WorkManager: в тестах нужна
 * предсказуемость, а не «когда система сочтёт нужным». Случай «сети нет»
 * воспроизводится через [goOffline].
 */
class NotesTestBackend : AutoCloseable {

    private data class StoredNote(
        val id: String,
        var title: String?,
        var text: String,
        var version: Int,
        val createdAt: Instant,
        var updatedAt: Instant,
    )

    /** Что именно ушло на сервер в запросах сохранения. */
    data class Update(val id: String, val title: String?, val text: String, val version: Int)

    private val json = Json { ignoreUnknownKeys = true }
    private val notes = linkedMapOf<String, StoredNote>()
    private val server = MockWebServer()

    /**
     * Замок на всё состояние сервера.
     *
     * Меняет его поток диспетчера MockWebServer, а читают проверки из потока
     * теста — без общей блокировки у них нет ни атомарности, ни гарантии
     * увидеть свежее значение. Оба следствия наблюдались вживую: проверка
     * видела уже записанный запрос на сохранение, но ещё старый текст
     * заметки, а ожидание в цикле подолгу крутилось на устаревшем значении —
     * отсюда сценарии по десять секунд вместо долей секунды. На двух ядрах
     * (раннер CI) это воспроизводилось стабильно, на четырёх — изредка.
     */
    private val lock = Any()

    private val recordedUpdates = mutableListOf<Update>()
    private val recordedSearchQueries = mutableListOf<String>()

    /**
     * Снимок запросов сохранения. Именно снимок, а не сам список: читающая
     * сторона иначе обошла бы замок.
     */
    val updates: List<Update> get() = synchronized(lock) { recordedUpdates.toList() }

    /** Запросы, с которыми приложение ходило в поиск, — по одному на запрос. */
    val searchQueries: List<String> get() = synchronized(lock) { recordedSearchQueries.toList() }

    private var searchResults: List<NoteSearchResultResponse> = emptyList()

    val repository: NotesRepository
    val syncer: NotesSyncer

    /**
     * Сессия поверх того же сервера. Конец сессии подключён к заметкам так
     * же, как в `AppContainer`, — за вычетом WorkManager и уведомлений,
     * которых здесь нет.
     */
    val authRepository: AuthRepository

    /** Пока false, `/Auth/refresh` отвечает `401`: сессия истекла или отозвана. */
    @Volatile
    private var sessionAlive = true

    private val database = Room
        .inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), NotesDatabase::class.java)
        .allowMainThreadQueries()
        .build()

    private val dao = database.notesDao()
    private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Запущенные фоновые отправки — их дожидается [awaitSyncIdle]. */
    private val syncJobs = mutableListOf<Job>()

    /** Пока true, любой запрос к серверу обрывается, как без сети. */
    @Volatile
    private var offline = false

    /** Пока не null, ответы на поиск ждут на нём — см. [holdSearches]. */
    @Volatile
    private var searchHold: CountDownLatch? = null

    /** Пока не null, ответы на сохранение ждут на нём — см. [holdUpdates]. */
    @Volatile
    private var updateHold: CountDownLatch? = null

    init {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = handle(request)
        }
        server.start()

        // Отсутствие сети имитируется на стороне клиента: обрыв сокета в
        // MockWebServer Retrofit принял за успешный пустой ответ, и «удаление
        // без сети» молча считалось выполненным.
        val cookieJar = SessionCookieJar(
            storage = CookieStorage(RuntimeEnvironment.getApplication()),
            baseUrl = server.url("/"),
            scope = syncScope,
        )

        val client = OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .addInterceptor { chain ->
                if (offline) throw IOException("Сети нет") else chain.proceed(chain.request())
            }
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        val api = retrofit.create<NotesApi>()
        syncer = NotesSyncer(api, dao)
        repository = NotesRepository(
            api = api,
            dao = dao,
            syncer = syncer,
            // Связь есть — отправляем сразу; в приложении то же самое делает
            // WorkManager, только дожидаясь сети. Ошибку отправки глушим так
            // же, как Worker: она не должна всплывать в чужом тесте.
            scheduler = SyncScheduler {
                synchronized(lock) { syncJobs += syncScope.launch { runCatching { syncer.push() } } }
            },
        )

        authRepository = AuthRepository(
            api = retrofit.create<AuthApi>(),
            tokens = TokenStore(),
            cookies = cookieJar,
            onSessionEnded = SessionEndListener { syncScope.launch { repository.forgetLocalData() } },
        )
    }

    /** Сервер больше не продлевает сессию: refresh-token истёк или отозван. */
    fun expireSession() {
        sessionAlive = false
    }

    /**
     * Задерживает ответы на поиск до [releaseSearches].
     *
     * Нужно там, где проверяется само состояние «запрос ушёл и ещё не
     * вернулся»: без задержки ответ успевает прийти раньше, чем проверка
     * посмотрит на состояние, и тест зависит от того, кто кого опередил.
     * Тот же приём, что `holdSearches()` в обвязке веб-интерфейса.
     */
    fun holdSearches() {
        searchHold = CountDownLatch(1)
    }

    /** Отпускает задержанные [holdSearches] ответы. */
    fun releaseSearches() {
        searchHold?.countDown()
        searchHold = null
    }

    /**
     * Задерживает ответы на сохранение до [releaseUpdates].
     *
     * Запрос при этом сервер получает и применяет сразу — ждёт только ответ.
     * Так открывается окно между «запрос ушёл» и «клиент узнал о результате»,
     * в котором заметку успевают править дальше.
     */
    fun holdUpdates() {
        updateHold = CountDownLatch(1)
    }

    /** Отпускает задержанные [holdUpdates] ответы. */
    fun releaseUpdates() {
        updateHold?.countDown()
        updateHold = null
    }

    /** Сеть пропала: запросы обрываются, как в метро. */
    fun goOffline() {
        offline = true
    }

    /** Связь вернулась. Отправить накопленное можно через [syncNow]. */
    fun goOnline() {
        offline = false
    }

    /** Отправляет очередь и возвращает заметки, отклонённые из-за конфликта. */
    fun syncNow() = runBlocking { syncer.push() }

    /**
     * Дожидается фоновых отправок, запущенных сохранением заметки.
     *
     * Нужно там, где проверяется результат именно явной [syncNow]: фоновая
     * отправка, поставленная в очередь ещё в офлайне, успевает выполниться
     * после возвращения связи и забирает себе и отправку, и конфликт — тогда
     * явной уже нечего делать. Ждать приходится в цикле: отправка может
     * поставить следующую.
     */
    fun awaitSyncIdle() = runBlocking {
        while (true) {
            val running = synchronized(lock) { syncJobs.filterNot { it.isCompleted } }
            if (running.isEmpty()) {
                return@runBlocking
            }

            running.joinAll()
        }
    }

    /** Локальный идентификатор заметки, известной серверу под [serverId]. */
    fun localIdOf(serverId: String): String? =
        runBlocking { dao.byServerId(serverId)?.localId }

    /** Сколько заметок лежит на устройстве, включая помеченные на удаление. */
    fun localNoteCount(): Int = runBlocking { dao.allNotes().size }

    /** Ждёт ли что-то отправки. */
    fun pendingCount(): Int =
        runBlocking { dao.allNotes().count { it.pendingOperation.name != "None" } }

    /** Сколько заметок сервер создал за всё время — от этого считается дата создания. */
    private var created = 0L

    /**
     * Заводит заметку на сервере. Каждая следующая создана на секунду позже
     * предыдущей: список сервер сортирует по дате создания, и по ней же
     * приложение судит, какие заметки страница должна была содержать.
     */
    fun addNote(title: String?, text: String): String = synchronized(lock) {
        val id = UUID.randomUUID().toString()
        val createdAt = Instant.parse("2026-09-20T12:00:00Z").plusSeconds(created++)
        notes[id] = StoredNote(id, title, text, version = 1, createdAt = createdAt, updatedAt = createdAt)
        id
    }

    /** Заметку удалили в другом месте — на другом устройстве или в вебе. */
    fun deleteElsewhere(id: String) {
        synchronized(lock) { notes.remove(id) }
    }

    /** Кто-то изменил заметку в другом месте: версия на сервере ушла вперёд. */
    fun editElsewhere(id: String, text: String) = synchronized(lock) {
        val note = notes.getValue(id)
        note.text = text
        note.version += 1
        note.updatedAt = Instant.parse("2026-09-20T13:00:00Z")
    }

    fun titleOf(id: String): String? = synchronized(lock) { notes.getValue(id).title }

    fun textOf(id: String): String = synchronized(lock) { notes.getValue(id).text }

    fun versionOf(id: String): Int = synchronized(lock) { notes.getValue(id).version }

    fun contains(id: String): Boolean = synchronized(lock) { notes.containsKey(id) }

    /** Заголовки всех заметок, которые сейчас есть на сервере. */
    fun allTitles(): List<String?> = synchronized(lock) { notes.values.map { it.title } }

    /**
     * Что сервер ответит на поиск. Ранжирование и разметку совпадений делает
     * настоящий сервер (Postgres с pg_trgm), воспроизводить их здесь
     * бессмысленно — проверяется поведение клиента, а не работа поиска.
     */
    fun setSearchResults(results: List<NoteSearchResultResponse>) = synchronized(lock) {
        searchResults = results
    }

    /** Результат поиска с единственным выделенным словом в заголовке и тексте. */
    fun searchResult(id: String, title: String?, before: String, match: String, after: String) =
        NoteSearchResultResponse(
            id = id,
            title = title?.let { listOf(HighlightedSegmentResponse(it, false)) } ?: emptyList(),
            snippet = listOf(
                HighlightedSegmentResponse(before, false),
                HighlightedSegmentResponse(match, true),
                HighlightedSegmentResponse(after, false),
            ),
        )

    override fun close() {
        // Задержанный ответ иначе оставил бы поток диспетчера ждать вечно, и
        // закрытие сервера повисло бы вместе с ним.
        releaseSearches()
        releaseUpdates()

        // Сначала останавливаем отправку: не остановив, мы закрываем базу из-под
        // работающей корутины, и следующий тест падает на чужом «connection is
        // closed» — ошибка всплывает не там, где произошла.
        // Отмена асинхронна, поэтому именно дожидаемся: иначе запрос успеет
        // наткнуться на закрытую базу уже в следующем тесте.
        runBlocking { syncScope.coroutineContext.job.cancelAndJoin() }
        database.close()
        server.close()
    }

    /**
     * Обработка запроса целиком под замком: для проверок из потока теста
     * запрос либо ещё не начался, либо уже полностью применён. Промежуточных
     * состояний вроде «запрос записан, но текст заметки ещё прежний» не
     * бывает, и ждать по одному признаку, а проверять другой — безопасно.
     */
    private fun handle(request: RecordedRequest): MockResponse {
        // Задержка — до замка: иначе придержанный ответ держал бы на себе всё
        // состояние сервера, и тест не смог бы ни проверить его, ни отпустить.
        if (request.url.encodedPath == "/Notes/search") {
            searchHold?.await()
        }

        val response = synchronized(lock) { respond(request) }

        // Сохранение задерживается уже после того, как сервер его применил:
        // ждёт только ответ. Поэтому «запрос записан — значит, применён»
        // остаётся верным и для задержанных запросов.
        if (request.method == "PUT") {
            updateHold?.await()
        }

        return response
    }

    private fun respond(request: RecordedRequest): MockResponse {
        val path = request.url.encodedPath
        val method = request.method

        return when {
            method == "POST" && path == "/Auth/google" -> sessionResponse()

            method == "POST" && path == "/Auth/refresh" ->
                if (sessionAlive) sessionResponse() else MockResponse.Builder().code(401).build()

            method == "POST" && path == "/Auth/logout" -> MockResponse.Builder().code(204).build()

            // Поиск разбирается раньше `/Notes/{id}`, иначе «search» будет
            // принят за идентификатор заметки.
            method == "GET" && path == "/Notes/search" -> {
                val query = request.url.queryParameter("query").orEmpty()
                recordedSearchQueries += query

                if (query.length < MIN_QUERY_LENGTH) {
                    MockResponse.Builder()
                        .code(400)
                        .body("Поисковый запрос должен быть не короче 3 символов.")
                        .build()
                } else {
                    ok(json.encodeToString(searchResults))
                }
            }

            // Страницы отдаются по-настоящему: за концом списка — пустая.
            // Без этого не воспроизвести подгрузку следующей страницы.
            method == "GET" && path == "/Notes" -> {
                val from = request.url.queryParameter("from")?.toIntOrNull() ?: 0
                val count = request.url.queryParameter("count")?.toIntOrNull() ?: 50
                val page = notes.values.reversed().drop(from).take(count)
                ok(json.encodeToString(page.map(::toSummaryResponse)))
            }

            method == "POST" && path == "/Notes" -> {
                val body = json.decodeFromString<Map<String, String?>>(request.bodyText())
                val id = addNote(body["title"], body["text"].orEmpty())
                ok(json.encodeToString(toResponse(notes.getValue(id))))
            }

            method == "GET" && path.startsWith("/Notes/") -> {
                val note = notes[path.removePrefix("/Notes/")] ?: return notFound()
                ok(json.encodeToString(toResponse(note)))
            }

            method == "PUT" && path.startsWith("/Notes/") -> {
                val id = path.removePrefix("/Notes/")
                val note = notes[id] ?: return notFound()
                val body = json.decodeFromString<UpdateNoteRequest>(request.bodyText())
                recordedUpdates += Update(id, body.title, body.text, body.version)

                if (body.version != note.version) {
                    return MockResponse.Builder()
                        .code(409)
                        .body("Заметка изменена в другом месте.")
                        .build()
                }

                note.title = body.title
                note.text = body.text
                note.version += 1
                note.updatedAt = Instant.parse("2026-09-20T14:00:00Z")
                ok(json.encodeToString(toResponse(note)))
            }

            method == "DELETE" && path.startsWith("/Notes/") -> {
                notes.remove(path.removePrefix("/Notes/"))
                MockResponse.Builder().code(204).build()
            }

            else -> notFound()
        }
    }

    /** Ответ на вход и продление: access-token в теле, refresh-token в cookie. */
    private fun sessionResponse() = MockResponse.Builder()
        .code(200)
        .addHeader("Content-Type", "application/json")
        .addHeader("Set-Cookie", "refresh_token=$REFRESH_TOKEN; Path=/Auth; HttpOnly")
        .body(json.encodeToString(AuthResponse(ACCESS_TOKEN, "2026-09-22T13:00:00Z", USER_NAME)))
        .build()

    private fun RecordedRequest.bodyText(): String = body?.utf8().orEmpty()

    companion object {
        /** Access-token, который сервер выдаёт при входе и продлении сессии. */
        const val ACCESS_TOKEN = "access-token"
        const val USER_NAME = "Тестовый пользователь"

        private const val REFRESH_TOKEN = "refresh-token"
        private const val MIN_QUERY_LENGTH = 3
    }

    private fun ok(body: String) = MockResponse.Builder()
        .code(200)
        .addHeader("Content-Type", "application/json")
        .body(body)
        .build()

    private fun notFound() = MockResponse.Builder()
        .code(400)
        .body("Заметка не найдена.")
        .build()

    private fun toResponse(note: StoredNote) = NoteResponse(
        id = note.id,
        title = note.title,
        text = note.text,
        version = note.version,
        createdAt = note.createdAt.toString(),
        updatedAt = note.updatedAt.toString(),
    )

    private fun toSummaryResponse(note: StoredNote) = NoteSummaryResponse(
        id = note.id,
        title = note.title,
        createdAt = note.createdAt.toString(),
        updatedAt = note.updatedAt.toString(),
    )
}
