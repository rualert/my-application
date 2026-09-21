package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

/**
 * Заметку изменили в другом месте (docs/docs/notes/android.md): сохранение
 * останавливается, напечатанное остаётся, а чьи правки оставить — решает
 * пользователь.
 */
class NoteConflictTest : NotesViewModelTestBase() {

    @Test
    fun `конфликт не затирает чужие правки и сохраняет напечатанное`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.editElsewhere(id, "Текст из другого места")

        // Act
        Sut.onTextChange("Моя правка")
        Sut.onStopped()
        awaitUntil("сервер ответил конфликтом") { Sut.editor.value.hasConflict }

        // Assert
        assertEquals("Текст из другого места", backend.textOf(id))
        assertEquals("Моя правка", Sut.editor.value.text)
    }

    @Test
    fun `после конфликта автосохранение останавливается`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.editElsewhere(id, "Текст из другого места")
        Sut.onTextChange("Моя правка")
        Sut.onStopped()
        awaitUntil("сервер ответил конфликтом") { Sut.editor.value.hasConflict }
        val attemptsBefore = backend.updates.size

        // Act
        Sut.onTextChange("Моя правка и ещё немного")
        testScheduler.advanceTimeBy(AUTOSAVE_DELAY_MILLIS * 3)
        testScheduler.runCurrent()

        // Assert
        // Повторять отклонённый запрос бессмысленно, пока конфликт не разрешён.
        // Признак «запрос пошёл» проверяется у клиента, а не по счётчику на
        // сервере: до сервера он дойдёт позже, и проверка бы его не заметила.
        assertFalse("Автосохранение при конфликте стоит", Sut.editor.value.isSaving)
        assertEquals(attemptsBefore, backend.updates.size)
    }

    @Test
    fun `загрузить актуальную заменяет черновик серверной версией`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.editElsewhere(id, "Текст из другого места")
        Sut.onTextChange("Моя правка")
        Sut.onStopped()
        awaitUntil("сервер ответил конфликтом") { Sut.editor.value.hasConflict }

        // Act
        Sut.reloadFromServer()
        awaitUntil("черновик заменён серверной версией") {
            Sut.editor.value.text == "Текст из другого места"
        }

        // Assert
        assertFalse(Sut.editor.value.hasConflict)
    }

    @Test
    fun `перезаписать моей сохраняет черновик поверх чужих правок`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.editElsewhere(id, "Текст из другого места")
        Sut.onTextChange("Моя правка")
        Sut.onStopped()
        awaitUntil("сервер ответил конфликтом") { Sut.editor.value.hasConflict }

        // Act
        Sut.overwriteWithMine()
        awaitUntil("черновик записан поверх") { backend.textOf(id) == "Моя правка" }

        // Assert
        assertFalse(Sut.editor.value.hasConflict)
        assertEquals("Моя правка", Sut.editor.value.text)
    }

    @Test
    fun `после разрешения конфликта автосохранение снова работает`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.editElsewhere(id, "Текст из другого места")
        Sut.onTextChange("Моя правка")
        Sut.onStopped()
        awaitUntil("сервер ответил конфликтом") { Sut.editor.value.hasConflict }
        Sut.overwriteWithMine()
        awaitUntil("черновик записан поверх") { backend.textOf(id) == "Моя правка" }
        val attemptsBefore = backend.updates.size

        // Act
        Sut.onTextChange("Правка после конфликта")
        testScheduler.advanceTimeBy(AUTOSAVE_DELAY_MILLIS + 1)
        awaitUntil("сохранение дошло до сервера") { backend.updates.size > attemptsBefore }

        // Assert
        assertEquals("Правка после конфликта", backend.textOf(id))
    }
}
