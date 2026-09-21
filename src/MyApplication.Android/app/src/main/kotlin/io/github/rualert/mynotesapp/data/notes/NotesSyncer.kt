package io.github.rualert.mynotesapp.data.notes

import io.github.rualert.mynotesapp.data.api.CreateNoteRequest
import io.github.rualert.mynotesapp.data.api.NoteResponse
import io.github.rualert.mynotesapp.data.api.NotesApi
import io.github.rualert.mynotesapp.data.api.UpdateNoteRequest
import io.github.rualert.mynotesapp.data.local.NoteEntity
import io.github.rualert.mynotesapp.data.local.NotesDao
import io.github.rualert.mynotesapp.data.local.PendingOperation
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import java.io.IOException
import java.time.Instant

/** Заметка, отправку которой сервер отклонил: её изменили в другом месте. */
data class SyncConflict(val localId: String, val title: String?)

/**
 * Отправляет накопленные изменения на сервер и забирает оттуда актуальный
 * список.
 *
 * Здесь же живёт единственное место, где локальные идентификаторы встречаются
 * с серверными: заметка, созданная без сети, получает `serverId` только после
 * успешной отправки, а ссылки интерфейса на неё остаются прежними.
 */
class NotesSyncer(
    private val api: NotesApi,
    private val dao: NotesDao,
) {

    /**
     * Обмен с сервером идёт по одному за раз.
     *
     * Поводов начать его несколько и они независимы: сохранение заметки просит
     * отправить сразу, фоновая задача — когда появилась сеть, экран списка
     * тянет свежую страницу. Наложение двух таких обменов портит данные, и оба
     * случая наблюдались в тестах:
     *
     * - две отправки читают очередь до того, как первая успела её разобрать, и
     *   шлют одну и ту же правку дважды; вторая получает `409`, и успешно
     *   сохранённая заметка остаётся помеченной конфликтной и «неотправленной»
     *   навсегда;
     * - загрузка списка пишет в базу страницу, полученную до удаления заметки,
     *   и удалённая заметка возвращается — уже с новым локальным
     *   идентификатором, как чужая.
     */
    private val exchange = Mutex()

    /**
     * Отправляет всё, что ждёт отправки, в порядке правок.
     *
     * @return заметки, которые сервер отклонил из-за конфликта версий.
     *
     * Сетевая ошибка прекращает проход: очередь остаётся на месте и уйдёт при
     * следующей попытке. Порядок при этом не нарушается — иначе правка могла
     * бы опередить создание той же заметки.
     */
    suspend fun push(): List<SyncConflict> = exchange.withLock { pushAll() }

    /** Забирает страницу списка с сервера, не затирая неотправленное. */
    suspend fun pull(from: Int = 0, count: Int = PAGE_SIZE) = exchange.withLock { pullPage(from, count) }

    private suspend fun pushAll(): List<SyncConflict> {
        val conflicts = mutableListOf<SyncConflict>()

        dao.pendingChanges().forEach { note ->
            try {
                when (note.pendingOperation) {
                    PendingOperation.Create -> pushCreate(note)
                    PendingOperation.Update -> pushUpdate(note, conflicts)
                    PendingOperation.Delete -> pushDelete(note)
                    PendingOperation.None -> Unit
                }
            } catch (failure: IOException) {
                // Связи нет — остальное тоже не уйдёт, пробовать дальше незачем.
                return conflicts
            }
        }

        return conflicts
    }

    private suspend fun pullPage(from: Int, count: Int) {
        val page = api.list(from, count)
        val serverNotes = page.map { summary ->
            val existing = dao.byServerId(summary.id)
            NoteEntity(
                localId = existing?.localId ?: newLocalId(),
                serverId = summary.id,
                // Список приходит без текста: у известной заметки он остаётся
                // прежним, у новой появится при открытии.
                title = summary.title,
                text = existing?.text.orEmpty(),
                version = existing?.version ?: 0,
                createdAt = Instant.parse(summary.createdAt).toEpochMilli(),
                updatedAt = Instant.parse(summary.updatedAt).toEpochMilli(),
                pendingOperation = PendingOperation.None,
                hasConflict = false,
                savedLocallyAt = existing?.savedLocallyAt,
            )
        }

        // Удалённые в другом месте заметки видно только по полному списку:
        // страницу за его концом сервер отдаёт пустой.
        dao.replaceServerNotes(serverNotes, deleteMissing = from == 0)
    }

    private suspend fun pushCreate(note: NoteEntity) {
        val created = api.create(CreateNoteRequest(note.title, note.text))
        dao.upsert(note.synced(created))
    }

    private suspend fun pushUpdate(note: NoteEntity, conflicts: MutableList<SyncConflict>) {
        val serverId = note.serverId ?: return

        try {
            val updated = api.update(serverId, UpdateNoteRequest(note.title, note.text, note.version))
            dao.upsert(note.synced(updated))
        } catch (failure: HttpException) {
            if (failure.code() == HTTP_CONFLICT) {
                // Правки остаются на устройстве: выбор, чьи оставить, за пользователем.
                dao.upsert(note.copy(hasConflict = true))
                conflicts += SyncConflict(note.localId, note.title)
            } else {
                throw failure
            }
        }
    }

    private suspend fun pushDelete(note: NoteEntity) {
        val serverId = note.serverId
        if (serverId == null) {
            dao.delete(note)
            return
        }

        try {
            api.delete(serverId)
        } catch (failure: HttpException) {
            // Заметки на сервере уже нет — значит, результат достигнут.
            if (failure.code() != HTTP_BAD_REQUEST) {
                throw failure
            }
        }

        dao.delete(note)
    }

    private fun NoteEntity.synced(response: NoteResponse) = copy(
        serverId = response.id,
        title = response.title,
        text = response.text,
        version = response.version,
        updatedAt = Instant.parse(response.updatedAt).toEpochMilli(),
        pendingOperation = PendingOperation.None,
        hasConflict = false,
    )

    private companion object {
        const val PAGE_SIZE = 50
        const val HTTP_CONFLICT = 409
        const val HTTP_BAD_REQUEST = 400
    }
}

/** Идентификатор, который есть у заметки до того, как о ней узнает сервер. */
internal fun newLocalId(): String = java.util.UUID.randomUUID().toString()
