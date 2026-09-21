package io.github.rualert.mynotesapp.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Что именно ждёт отправки на сервер. `None` — заметка отправлена и совпадает
 * с серверной копией.
 */
enum class PendingOperation { None, Create, Update, Delete }

/**
 * Заметка на устройстве.
 *
 * Ключ — **локальный** идентификатор: он есть у заметки с первой секунды, ещё
 * до того, как о ней узнает сервер, и не меняется никогда. Серверный
 * идентификатор появляется позже и хранится отдельно ([serverId]); интерфейс
 * оперирует только локальным, поэтому ссылка на открытую заметку не
 * протухает в момент, когда её наконец создали на сервере.
 *
 * [version] — версия, от которой отталкивался пользователь. Она уходит в
 * запрос обновления, и по ней сервер замечает правку из другого места.
 */
@Entity(tableName = "notes")
data class NoteEntity(
    @PrimaryKey val localId: String,
    val serverId: String?,
    val title: String?,
    val text: String,
    val version: Int,
    val createdAt: Long,
    val updatedAt: Long,
    val pendingOperation: PendingOperation,
    /** Сервер отклонил отправку: заметку изменили в другом месте. */
    val hasConflict: Boolean,
    /** Когда правка легла на устройство — от этого считается статус сохранения. */
    val savedLocallyAt: Long?,
)
