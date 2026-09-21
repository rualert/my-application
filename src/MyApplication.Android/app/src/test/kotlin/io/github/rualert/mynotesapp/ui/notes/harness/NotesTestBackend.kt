package io.github.rualert.mynotesapp.ui.notes.harness

import io.github.rualert.mynotesapp.data.api.HighlightedSegmentResponse
import io.github.rualert.mynotesapp.data.api.NoteResponse
import io.github.rualert.mynotesapp.data.api.NoteSearchResultResponse
import io.github.rualert.mynotesapp.data.api.NoteSummaryResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.api.UpdateNoteRequest
import io.github.rualert.mynotesapp.data.notes.NotesRepository
import kotlinx.serialization.json.Json
import mockwebserver3.Dispatcher
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import mockwebserver3.RecordedRequest
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.create
import java.time.Instant
import java.util.UUID

/**
 * Настоящий API заметок в миниатюре: хранит заметки в памяти и соблюдает
 * правило версий, поэтому `PUT` с устаревшей версией получает `409` — так же,
 * как от настоящего сервера.
 *
 * Подменяется только сеть: репозиторий, Retrofit и разбор ответов в тестах
 * работают настоящие (см. CLAUDE.md — то же правило, что у MSW в вебе).
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

    init {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse = handle(request)
        }
        server.start()

        val retrofit = Retrofit.Builder()
            .baseUrl(server.url("/"))
            .client(OkHttpClient())
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        repository = NotesRepository(retrofit.create<NotesApi>())
    }

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

    override fun close() = server.close()

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

            method == "GET" && path == "/Notes" -> ok(
                json.encodeToString(notes.values.reversed().map(::toSummaryResponse)),
            )

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
