package io.github.rualert.mynotesapp.ui.notes.harness

import io.github.rualert.mynotesapp.data.api.HighlightedSegmentResponse
import io.github.rualert.mynotesapp.data.api.NoteResponse
import io.github.rualert.mynotesapp.data.api.NoteSearchResultResponse
import io.github.rualert.mynotesapp.data.api.NoteSummaryResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.api.UpdateNoteRequest
import androidx.room.Room
import io.github.rualert.mynotesapp.data.local.NotesDatabase
import io.github.rualert.mynotesapp.data.notes.NotesRepository
import io.github.rualert.mynotesapp.data.notes.NotesSyncer
import io.github.rualert.mynotesapp.data.notes.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.job
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

    val updates = mutableListOf<Update>()

    /** Запросы, с которыми приложение ходило в поиск, — по одному на запрос. */
    val searchQueries = mutableListOf<String>()

    private var searchResults: List<NoteSearchResultResponse> = emptyList()

    val repository: NotesRepository
    val syncer: NotesSyncer

    private val database = Room
        .inMemoryDatabaseBuilder(RuntimeEnvironment.getApplication(), NotesDatabase::class.java)
        .allowMainThreadQueries()
        .build()

    private val dao = database.notesDao()
    private val syncScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Пока true, любой запрос к серверу обрывается, как без сети. */
    @Volatile
    private var offline = false

    init {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = handle(request)
        }
        server.start()

        // Отсутствие сети имитируется на стороне клиента: обрыв сокета в
        // MockWebServer Retrofit принял за успешный пустой ответ, и «удаление
        // без сети» молча считалось выполненным.
        val client = OkHttpClient.Builder()
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
            scheduler = SyncScheduler { syncScope.launch { runCatching { syncer.push() } } },
        )
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

    /** Локальный идентификатор заметки, известной серверу под [serverId]. */
    fun localIdOf(serverId: String): String? =
        runBlocking { dao.byServerId(serverId)?.localId }

    /** Ждёт ли что-то отправки. */
    fun pendingCount(): Int =
        runBlocking { dao.allNotes().count { it.pendingOperation.name != "None" } }

    fun addNote(title: String?, text: String): String {
        val id = UUID.randomUUID().toString()
        val now = Instant.parse("2026-09-20T12:00:00Z")
        notes[id] = StoredNote(id, title, text, version = 1, createdAt = now, updatedAt = now)
        return id
    }

    /** Кто-то изменил заметку в другом месте: версия на сервере ушла вперёд. */
    fun editElsewhere(id: String, text: String) {
        val note = notes.getValue(id)
        note.text = text
        note.version += 1
        note.updatedAt = Instant.parse("2026-09-20T13:00:00Z")
    }

    fun titleOf(id: String): String? = notes.getValue(id).title

    fun textOf(id: String): String = notes.getValue(id).text

    fun versionOf(id: String): Int = notes.getValue(id).version

    fun contains(id: String): Boolean = notes.containsKey(id)

    /** Заголовки всех заметок, которые сейчас есть на сервере. */
    fun allTitles(): List<String?> = notes.values.map { it.title }

    /**
     * Что сервер ответит на поиск. Ранжирование и разметку совпадений делает
     * настоящий сервер (Postgres с pg_trgm), воспроизводить их здесь
     * бессмысленно — проверяется поведение клиента, а не работа поиска.
     */
    fun setSearchResults(results: List<NoteSearchResultResponse>) {
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
        // Сначала останавливаем отправку: не остановив, мы закрываем базу из-под
        // работающей корутины, и следующий тест падает на чужом «connection is
        // closed» — ошибка всплывает не там, где произошла.
        // Отмена асинхронна, поэтому именно дожидаемся: иначе запрос успеет
        // наткнуться на закрытую базу уже в следующем тесте.
        runBlocking { syncScope.coroutineContext.job.cancelAndJoin() }
        database.close()
        server.close()
    }

    private fun handle(request: RecordedRequest): MockResponse {
        val path = request.url.encodedPath
        val method = request.method

        return when {
            // Поиск разбирается раньше `/Notes/{id}`, иначе «search» будет
            // принят за идентификатор заметки.
            method == "GET" && path == "/Notes/search" -> {
                val query = request.url.queryParameter("query").orEmpty()
                searchQueries += query

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
                updates += Update(id, body.title, body.text, body.version)

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

    private fun RecordedRequest.bodyText(): String = body?.utf8().orEmpty()

    private companion object {
        const val MIN_QUERY_LENGTH = 3
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
