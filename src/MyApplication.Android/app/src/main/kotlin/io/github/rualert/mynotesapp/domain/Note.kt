package io.github.rualert.mynotesapp.domain

import java.time.Instant

/**
 * Заметка целиком.
 *
 * [title] необязателен: у заметки без заголовка на сервере хранится `null`, и
 * приложение эту «пустоту» не подменяет заглушкой — «Без названия» существует
 * только на экране (см. [displayTitle]).
 *
 * [version] — версия, от которой пользователь отталкивается при правке. Она
 * уходит обратно в каждое сохранение, и по ней сервер замечает, что заметку
 * изменили в другом месте.
 */
data class Note(
    val id: String,
    val title: String?,
    val text: String,
    val version: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
    /** Правка сохранена на устройстве, но ещё не ушла на сервер. */
    val isPending: Boolean = false,
    /** Сервер отклонил отправку: заметку изменили в другом месте. */
    val hasConflict: Boolean = false,
    /** Когда правка легла на устройство. */
    val savedLocallyAt: Instant? = null,
)

/** Краткие сведения для списка: без текста и без версии — править оттуда нечего. */
data class NoteSummary(
    val id: String,
    val title: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val isPending: Boolean = false,
    val hasConflict: Boolean = false,
)

/**
 * Заголовок для отправки на сервер: пустой или состоящий из пробелов
 * означает отсутствие заголовка, а не строку из пробелов.
 */
fun titleForRequest(title: String): String? = title.takeIf { it.isNotBlank() }

/** Есть ли у заметки заголовок — от этого зависит, показывать ли «Без названия». */
fun hasTitle(title: String?): Boolean = !title.isNullOrBlank()
