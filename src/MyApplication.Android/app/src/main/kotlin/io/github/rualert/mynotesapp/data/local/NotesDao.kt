package io.github.rualert.mynotesapp.data.local

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface NotesDao {

    /**
     * Список для экрана: удалённые пользователем заметки скрыты сразу, хотя на
     * сервере они ещё есть — иначе удаление без сети выглядело бы как отказ.
     */
    @Query("SELECT * FROM notes WHERE pendingOperation != 'Delete' ORDER BY createdAt DESC")
    fun observeNotes(): Flow<List<NoteEntity>>

    @Query("SELECT * FROM notes WHERE localId = :localId")
    fun observeNote(localId: String): Flow<NoteEntity?>

    @Query("SELECT * FROM notes WHERE localId = :localId")
    suspend fun byLocalId(localId: String): NoteEntity?

    @Query("SELECT * FROM notes WHERE serverId = :serverId")
    suspend fun byServerId(serverId: String): NoteEntity?

    /**
     * Что ждёт отправки. Порядок по времени правки: заметку, созданную офлайн
     * и потом исправленную, сервер должен увидеть в том же порядке.
     *
     * Заметки с неразрешённым конфликтом пропускаются — повторять отклонённый
     * запрос бессмысленно, пока пользователь не решил, чьи правки оставить.
     */
    @Query(
        """
        SELECT * FROM notes
        WHERE pendingOperation != 'None' AND hasConflict = 0
        ORDER BY updatedAt ASC
        """,
    )
    suspend fun pendingChanges(): List<NoteEntity>

    @Query("SELECT COUNT(*) FROM notes WHERE pendingOperation != 'None'")
    fun observePendingCount(): Flow<Int>

    /** Заметки, отправку которых сервер отклонил из-за правки в другом месте. */
    @Query("SELECT localId FROM notes WHERE hasConflict = 1")
    fun observeConflicted(): Flow<List<String>>

    @Upsert
    suspend fun upsert(note: NoteEntity)

    @Delete
    suspend fun delete(note: NoteEntity)

    @Query("DELETE FROM notes")
    suspend fun deleteAll()

    /**
     * Кладёт текст заметки, дочитанный с сервера, — но только если строка всё
     * ещё та же.
     *
     * Запрос за текстом идёт по сети, и за это время заметку успевают удалить
     * или поправить. Записывать по прочитанной до запроса копии нельзя: удалённая
     * заметка так воскресает (`upsert` создаёт строку заново), а сделанная
     * тем временем правка затирается серверной — вместе с пометкой, что её
     * надо отправить. Поэтому строка перечитывается здесь же, в транзакции.
     */
    @Transaction
    suspend fun applyFetchedNote(
        localId: String,
        title: String?,
        text: String,
        version: Int,
        updatedAt: Long,
    ) {
        val current = byLocalId(localId) ?: return

        if (current.pendingOperation != PendingOperation.None || current.hasConflict) {
            return
        }

        upsert(
            current.copy(
                title = title,
                text = text,
                version = version,
                updatedAt = updatedAt,
            ),
        )
    }

    /**
     * Принимает список с сервера, не затирая несохранённое.
     *
     * Заметки, у которых есть неотправленные изменения, остаются как есть:
     * серверная копия для них устарела по определению — это её и предстоит
     * заменить.
     *
     * @param deleteMissing убирать ли заметки, которых в присланном списке нет.
     * Так узнают об удалении в другом месте, но **только когда пришёл список
     * целиком**. Для второй и последующих страниц это неверно: страница за
     * концом списка приходит пустой, и «удаление отсутствующих» стёрло бы с
     * устройства вообще всё.
     */
    @Transaction
    suspend fun replaceServerNotes(serverNotes: List<NoteEntity>, deleteMissing: Boolean) {
        val local = allNotes().associateBy { it.serverId }

        serverNotes.forEach { fromServer ->
            val existing = local[fromServer.serverId]
            when {
                existing == null -> upsert(fromServer)

                existing.pendingOperation != PendingOperation.None || existing.hasConflict -> Unit

                else -> upsert(fromServer.copy(localId = existing.localId))
            }
        }

        if (!deleteMissing) {
            return
        }

        val serverIds = serverNotes.mapNotNull { it.serverId }.toSet()
        allNotes()
            .filter { it.serverId != null && it.serverId !in serverIds }
            .filter { it.pendingOperation == PendingOperation.None && !it.hasConflict }
            .forEach { delete(it) }
    }

    @Query("SELECT * FROM notes")
    suspend fun allNotes(): List<NoteEntity>
}
