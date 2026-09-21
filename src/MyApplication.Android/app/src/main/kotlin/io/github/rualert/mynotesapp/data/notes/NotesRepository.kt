package io.github.rualert.mynotesapp.data.notes

import io.github.rualert.mynotesapp.data.api.HighlightedSegmentResponse
import io.github.rualert.mynotesapp.data.api.NoteSearchResultResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.local.NoteEntity
import io.github.rualert.mynotesapp.data.local.NotesDao
import io.github.rualert.mynotesapp.data.local.PendingOperation
import io.github.rualert.mynotesapp.domain.HighlightedSegment
import io.github.rualert.mynotesapp.domain.Note
import io.github.rualert.mynotesapp.domain.NoteSearchResult
import io.github.rualert.mynotesapp.domain.NoteSummary
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Clock
import java.time.Instant

/**
 * Заметки: на устройстве они есть всегда, сервер — то, с чем их рано или
 * поздно сверяют.
 *
 * Любая правка ложится в локальное хранилище немедленно и не может не
 * удаться. Отправкой занимается [NotesSyncer], запускаемый [SyncScheduler] —
 * сразу, если связь есть, и при её появлении, если нет.
 *
 * Поиск — единственная операция, которой нужна сеть: ранжирование с учётом
 * опечаток делает Postgres, и воспроизводить его на устройстве значило бы
 * завести второй поиск, находящий не то же самое.
 */
class NotesRepository(
    private val api: NotesApi,
    private val dao: NotesDao,
    private val syncer: NotesSyncer,
    private val scheduler: SyncScheduler,
    private val clock: Clock = Clock.systemUTC(),
) {

    fun observeNotes(): Flow<List<NoteSummary>> =
        dao.observeNotes().map { notes -> notes.map(NoteEntity::toSummary) }

    fun observeNote(localId: String): Flow<Note?> =
        dao.observeNote(localId).map { note -> note?.toDomain() }

    /** Есть ли что-то, что ещё не ушло на сервер. */
    fun observePendingCount(): Flow<Int> = dao.observePendingCount()

    /**
     * Заметки, у которых отправка упёрлась в конфликт. Экран узнаёт о нём
     * отсюда: обнаружить конфликт может отправка в фоне, когда заметку никто
     * не открывал.
     */
    fun observeConflicts(): Flow<Set<String>> = dao.observeConflicted().map { it.toSet() }

    suspend fun noteById(localId: String): Note? = dao.byLocalId(localId)?.toDomain()

    /**
     * Забирает список с сервера. Если связи нет, остаётся то, что на
     * устройстве, — для вызывающей стороны это не ошибка, а обычный офлайн.
     */
    suspend fun refresh(): Result<Unit> = runCatching { syncer.pull() }

    suspend fun loadMore(from: Int): Result<Unit> = runCatching { syncer.pull(from = from) }

    /**
     * Догружает текст заметки, если на устройстве его ещё нет: список
     * приходит без текстов.
     */
    suspend fun ensureText(localId: String): Result<Unit> {
        val note = dao.byLocalId(localId) ?: return Result.success(Unit)
        val serverId = note.serverId
        if (serverId == null || note.pendingOperation != PendingOperation.None || note.version > 0) {
            return Result.success(Unit)
        }

        return runCatching {
            val full = api.byId(serverId)
            // По прочитанной до запроса копии писать нельзя: пока текст ехал,
            // заметку могли удалить или поправить — см. NotesDao.applyFetchedNote.
            dao.applyFetchedNote(
                localId = localId,
                title = full.title,
                text = full.text,
                version = full.version,
                updatedAt = Instant.parse(full.updatedAt).toEpochMilli(),
            )
        }
    }

    suspend fun createNote(): Note {
        val now = clock.instant().toEpochMilli()
        val note = NoteEntity(
            localId = newLocalId(),
            serverId = null,
            title = null,
            text = "",
            version = 0,
            createdAt = now,
            updatedAt = now,
            pendingOperation = PendingOperation.Create,
            hasConflict = false,
            savedLocallyAt = now,
        )

        dao.upsert(note)
        scheduler.requestSync()
        return note.toDomain()
    }

    /**
     * Сохраняет правку на устройстве и ставит её в очередь на отправку.
     *
     * Заметка, ещё не созданная на сервере, так и остаётся «созданием»: слать
     * обновление тому, чего там нет, бессмысленно.
     */
    suspend fun saveDraft(localId: String, title: String?, text: String) {
        val note = dao.byLocalId(localId) ?: return
        val now = clock.instant().toEpochMilli()

        dao.upsert(
            note.copy(
                title = title,
                text = text,
                updatedAt = now,
                savedLocallyAt = now,
                pendingOperation = if (note.serverId == null) {
                    PendingOperation.Create
                } else {
                    PendingOperation.Update
                },
            ),
        )

        scheduler.requestSync()
    }

    suspend fun deleteNote(localId: String) {
        val note = dao.byLocalId(localId) ?: return

        if (note.serverId == null) {
            // Сервер о ней не знает — и не узнает.
            dao.delete(note)
            return
        }

        dao.upsert(note.copy(pendingOperation = PendingOperation.Delete, hasConflict = false))
        scheduler.requestSync()
    }

    /** Конфликт: отказаться от своих правок в пользу серверной версии. */
    suspend fun reloadFromServer(localId: String): Result<Unit> {
        val note = dao.byLocalId(localId) ?: return Result.success(Unit)
        val serverId = note.serverId ?: return Result.success(Unit)

        return runCatching {
            val full = api.byId(serverId)
            dao.upsert(
                note.copy(
                    title = full.title,
                    text = full.text,
                    version = full.version,
                    updatedAt = Instant.parse(full.updatedAt).toEpochMilli(),
                    pendingOperation = PendingOperation.None,
                    hasConflict = false,
                ),
            )
        }
    }

    /** Конфликт: оставить своё, взяв у сервера только актуальную версию. */
    suspend fun overwriteWithMine(localId: String): Result<Unit> {
        val note = dao.byLocalId(localId) ?: return Result.success(Unit)
        val serverId = note.serverId ?: return Result.success(Unit)

        return runCatching {
            val full = api.byId(serverId)
            dao.upsert(
                note.copy(
                    version = full.version,
                    pendingOperation = PendingOperation.Update,
                    hasConflict = false,
                ),
            )
            scheduler.requestSync()
        }
    }

    suspend fun search(query: String): List<NoteSearchResult> =
        api.search(query).map { result ->
            NoteSearchResult(
                // Наружу отдаётся локальный идентификатор: интерфейс знает
                // заметки только по нему.
                id = dao.byServerId(result.id)?.localId ?: result.id,
                title = result.title.map(HighlightedSegmentResponse::toDomain),
                snippet = result.snippet.map(HighlightedSegmentResponse::toDomain),
            )
        }
}

private fun HighlightedSegmentResponse.toDomain() = HighlightedSegment(text = text, match = match)

private fun NoteEntity.toDomain() = Note(
    id = localId,
    title = title,
    text = text,
    version = version,
    createdAt = Instant.ofEpochMilli(createdAt),
    updatedAt = Instant.ofEpochMilli(updatedAt),
    isPending = pendingOperation != PendingOperation.None,
    hasConflict = hasConflict,
    savedLocallyAt = savedLocallyAt?.let(Instant::ofEpochMilli),
)

private fun NoteEntity.toSummary() = NoteSummary(
    id = localId,
    title = title,
    createdAt = Instant.ofEpochMilli(createdAt),
    updatedAt = Instant.ofEpochMilli(updatedAt),
    isPending = pendingOperation != PendingOperation.None,
    hasConflict = hasConflict,
)
