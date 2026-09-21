package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Правила автосохранения из docs/docs/notes/android.md и web-ui.md:
 * через пять секунд после первой несохранённой правки, дальнейший набор
 * таймер не сдвигает, плюс немедленное сохранение при уходе с заметки и в фон.
 */
class NoteAutosaveTest : NotesViewModelTestBase() {

    @Test
    fun `правка сохраняется через пять секунд`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)

        // Act
        Sut.onTextChange("Другой текст")
        testScheduler.advanceTimeBy(AUTOSAVE_DELAY_MILLIS + 1)
        awaitUntil("сохранение дошло до сервера") { backend.updates.isNotEmpty() }

        // Assert
        assertEquals("Другой текст", backend.textOf(id))
    }

    @Test
    fun `дальнейший набор не сдвигает таймер`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)

        // Act
        // Проверки делаются без единого приостановления теста: стоит ему
        // уснуть в ожидании ответа сервера, как runTest сам прокрутит
        // виртуальное время вперёд — и отложенный запрос уйдёт независимо от
        // того, сдвигается таймер или нет.
        Sut.onTextChange("раз")
        testScheduler.advanceTimeBy(3_000)
        Sut.onTextChange("раз два")
        testScheduler.advanceTimeBy(1_000)
        testScheduler.runCurrent()
        val savingAtFourSeconds = Sut.editor.value.isSaving

        testScheduler.advanceTimeBy(1_500)
        testScheduler.runCurrent()
        val savingAtFiveAndHalfSeconds = Sut.editor.value.isSaving

        // Assert
        assertFalse("До пяти секунд сохранять рано", savingAtFourSeconds)
        // Отсчёт идёт от первой правки: набор на третьей секунде его не сдвинул.
        assertTrue("Через пять секунд после первой правки запрос уже идёт", savingAtFiveAndHalfSeconds)

        awaitUntil("сохранение дошло до сервера") { backend.updates.isNotEmpty() }
        assertEquals("раз два", backend.textOf(id))
    }

    @Test
    fun `без изменений запрос не отправляется`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)

        // Act
        Sut.backToList()
        testScheduler.advanceTimeBy(AUTOSAVE_DELAY_MILLIS * 2)
        testScheduler.runCurrent()

        // Assert
        assertFalse("Сохранять нечего: заметку не меняли", Sut.editor.value.isSaving)
        assertTrue(backend.updates.isEmpty())
    }

    @Test
    fun `возврат к списку сохраняет сразу`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)
        Sut.onTextChange("Успеть до ухода")

        // Act
        Sut.backToList()
        awaitUntil("сохранение дошло до сервера") { backend.updates.isNotEmpty() }

        // Assert
        assertEquals("Успеть до ухода", backend.textOf(id))
    }

    @Test
    fun `уход приложения в фон сохраняет сразу`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)
        Sut.onTitleChange("Новый заголовок")

        // Act
        Sut.onStopped()
        awaitUntil("сохранение дошло до сервера") { backend.updates.isNotEmpty() }

        // Assert
        assertEquals("Новый заголовок", backend.titleOf(id))
    }

    @Test
    fun `переход к другой заметке сохраняет предыдущую`() = runTest(dispatcher) {
        // Arrange
        val first = backend.addNote("Первая", "Текст первой")
        val second = backend.addNote("Вторая", "Текст второй")
        openAndAwait(first)
        Sut.onTextChange("Правка первой")

        // Act
        openAndAwait(second)
        awaitUntil("сохранение первой дошло до сервера") { backend.updates.isNotEmpty() }

        // Assert
        assertEquals("Правка первой", backend.textOf(first))
        assertEquals("Текст второй", Sut.editor.value.text)
    }

    @Test
    fun `пустой заголовок уходит как отсутствие заголовка`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openAndAwait(id)

        // Act
        Sut.onTitleChange("   ")
        Sut.onStopped()
        awaitUntil("сохранение дошло до сервера") { backend.updates.isNotEmpty() }

        // Assert
        // «Без названия» — это отсутствие заголовка, а не строка из пробелов.
        assertNull(backend.titleOf(id))
    }
}
