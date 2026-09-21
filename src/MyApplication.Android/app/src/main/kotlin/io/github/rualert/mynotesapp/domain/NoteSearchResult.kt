package io.github.rualert.mynotesapp.domain

/**
 * Отрезок текста из результата поиска. [match] означает, что это и есть
 * найденное место — его нужно выделить.
 */
data class HighlightedSegment(val text: String, val match: Boolean)

/**
 * Найденная заметка: заголовок и фрагмент текста вокруг совпадения, уже
 * разбитые сервером на отрезки.
 *
 * Разметку клиент не вычисляет сам и не может: заметку, найденную по
 * опечатке, искомое слово буквально не содержит — какое слово сервер счёл
 * похожим, знает только он (см. docs/docs/notes/api-contract).
 *
 * У заметки без заголовка [title] — пустой список.
 */
data class NoteSearchResult(
    val id: String,
    val title: List<HighlightedSegment>,
    val snippet: List<HighlightedSegment>,
)

/** Склеенный текст отрезков — нужен там, где разметка не важна. */
fun List<HighlightedSegment>.joinText(): String = joinToString(separator = "") { it.text }
