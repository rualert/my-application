package io.github.rualert.mynotesapp.data.notes

import io.github.rualert.mynotesapp.data.api.CreateNoteRequest
import io.github.rualert.mynotesapp.data.api.NoteResponse
import io.github.rualert.mynotesapp.data.api.NoteSummaryResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.api.UpdateNoteRequest
import io.github.rualert.mynotesapp.domain.Note
import io.github.rualert.mynotesapp.domain.NoteSummary
import retrofit2.HttpException
import java.time.Instant

/** Заметку изменили в другом месте: версия в запросе разошлась с серверной. */
class NoteConflictException : Exception("Заметка изменена в другом месте.")

/**
 * Доступ к заметкам через API. Здесь же транспортные DTO превращаются в
 * доменные модели, а `409` — в [NoteConflictException]: выше по стеку
 * конфликт разбирается как отдельный случай, а не как «какая-то ошибка HTTP».
 */
class NotesRepository(private val api: NotesApi) {

    suspend fun list(from: Int, count: Int): List<NoteSummary> =
        api.list(from, count).map(NoteSummaryResponse::toDomain)

    suspend fun byId(id: String): Note = api.byId(id).toDomain()

    suspend fun create(title: String?, text: String): Note =
        api.create(CreateNoteRequest(title, text)).toDomain()

    suspend fun update(id: String, title: String?, text: String, version: Int): Note =
        try {
            api.update(id, UpdateNoteRequest(title, text, version)).toDomain()
        } catch (failure: HttpException) {
            if (failure.code() == HTTP_CONFLICT) throw NoteConflictException() else throw failure
        }

    suspend fun delete(id: String) = api.delete(id)

    private companion object {
        const val HTTP_CONFLICT = 409
    }
}

private fun NoteResponse.toDomain() = Note(
    id = id,
    title = title,
    text = text,
    version = version,
    createdAt = Instant.parse(createdAt),
    updatedAt = Instant.parse(updatedAt),
)

private fun NoteSummaryResponse.toDomain() = NoteSummary(
    id = id,
    title = title,
    createdAt = Instant.parse(createdAt),
    updatedAt = Instant.parse(updatedAt),
)
