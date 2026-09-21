package io.github.rualert.mynotesapp.ui.notes

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Duration
import java.time.Instant
import java.time.ZoneId

/**
 * Формулировки статуса сохранения — те же, что в веб-интерфейсе
 * (docs/docs/notes/web-ui.md, «Сохранение заметок»).
 */
class SaveStatusTest {

    private val zone: ZoneId = ZoneId.of("UTC")
    private val savedAt: Instant = Instant.parse("2026-09-20T12:00:00Z")

    @Test
    fun `во время запроса показывается Сохраняется`() {
        // Arrange

        // Act
        val status = saveStatusText(isSaving = true, lastSavedAt = savedAt, now = savedAt, zone = zone)

        // Assert
        assertEquals("Сохраняется…", status)
    }

    @Test
    fun `до сохранения статуса нет`() {
        // Arrange

        // Act
        val status = saveStatusText(isSaving = false, lastSavedAt = null, now = savedAt, zone = zone)

        // Assert
        assertEquals("", status)
    }

    @Test
    fun `в пределах часа показываются минуты`() {
        // Arrange
        val now = savedAt.plus(Duration.ofMinutes(3))

        // Act
        val status = saveStatusText(isSaving = false, lastSavedAt = savedAt, now = now, zone = zone)

        // Assert
        assertEquals("Сохранение: 3 минут назад", status)
    }

    @Test
    fun `в пределах суток показывается время`() {
        // Arrange
        val now = savedAt.plus(Duration.ofHours(5))

        // Act
        val status = saveStatusText(isSaving = false, lastSavedAt = savedAt, now = now, zone = zone)

        // Assert
        assertEquals("Сохранение: 12:00", status)
    }

    @Test
    fun `больше суток назад показывается дата`() {
        // Arrange
        val now = savedAt.plus(Duration.ofDays(2))

        // Act
        val status = saveStatusText(isSaving = false, lastSavedAt = savedAt, now = now, zone = zone)

        // Assert
        assertEquals("Сохранение: 20.09.2026", status)
    }

    @Test
    fun `отставшие часы не дают отрицательное время`() {
        // Arrange
        // «Сейчас» тикает раз в полминуты и сразу после сохранения может
        // оказаться позади него — в вебе это давало «-1 минут назад».
        val now = savedAt.minus(Duration.ofSeconds(10))

        // Act
        val status = saveStatusText(isSaving = false, lastSavedAt = savedAt, now = now, zone = zone)

        // Assert
        assertEquals("Сохранение: 0 минут назад", status)
    }
}
