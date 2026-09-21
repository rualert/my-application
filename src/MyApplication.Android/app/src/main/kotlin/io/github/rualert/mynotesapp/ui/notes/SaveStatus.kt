package io.github.rualert.mynotesapp.ui.notes

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Текст статуса сохранения по правилам из docs/docs/notes/web-ui.md
 * («Сохранение заметок»): идёт запрос — «Сохраняется…»; не более часа назад —
 * минуты; не более суток — время; иначе — дата.
 *
 * Формулировки намеренно слово в слово те же, что в веб-интерфейсе
 * (`notes/saveStatusText.ts`): один и тот же статус не должен звучать на двух
 * клиентах по-разному.
 */
fun saveStatusText(
    isSaving: Boolean,
    lastSavedAt: Instant?,
    now: Instant,
    zone: ZoneId = ZoneId.systemDefault(),
    isPending: Boolean = false,
): String {
    if (isSaving) {
        return "Сохраняется…"
    }

    // На устройстве правка уже сохранена, но на сервере её ещё нет — время
    // сохранения показывать рано: с другого устройства заметка выглядит старой.
    if (isPending) {
        return "Не отправлено"
    }

    if (lastSavedAt == null) {
        return ""
    }

    // Отсчёт времени тикает раз в полминуты и сразу после сохранения может
    // отстать от lastSavedAt — отрицательную разницу не показываем.
    val elapsed = Duration.between(lastSavedAt, now).coerceAtLeast(Duration.ZERO)

    return when {
        elapsed < Duration.ofHours(1) -> "Сохранение: ${elapsed.toMinutes()} минут назад"
        elapsed < Duration.ofDays(1) -> "Сохранение: ${TIME_FORMATTER.format(lastSavedAt.atZone(zone))}"
        else -> "Сохранение: ${DATE_FORMATTER.format(lastSavedAt.atZone(zone))}"
    }
}

private val TIME_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
private val DATE_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("dd.MM.yyyy")
