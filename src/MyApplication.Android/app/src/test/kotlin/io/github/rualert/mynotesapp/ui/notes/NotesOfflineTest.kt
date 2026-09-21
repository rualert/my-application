package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Работа без сети — docs/docs/notes/android.md, раздел «Работа без сети».
 * Правка ложится на устройство сразу, а на сервер уезжает, когда связь
 * появится.
 */
class NotesOfflineTest : NotesViewModelTestBase() {

    @Test
    fun `правка без сети сохраняется на устройстве`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        val localId = openServerNote(id)
        backend.goOffline()

        // Act
        Sut.onTextChange("Написано в метро")
        Sut.onStopped()
        awaitUntil("правка помечена неотправленной") { Sut.editor.value.isPending }

        // Assert
        // На устройстве правка есть, на сервере — ещё нет.
        assertEquals("Написано в метро", Sut.editor.value.text)
        assertEquals("Текст", backend.textOf(id))
        assertEquals(localId, Sut.editor.value.noteId)
    }

    @Test
    fun `накопленное уходит на сервер когда связь возвращается`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Текст")
        openServerNote(id)
        backend.goOffline()
        Sut.onTextChange("Написано в метро")
        Sut.onStopped()
        awaitUntil("правка помечена неотправленной") { Sut.editor.value.isPending }

        // Act
        backend.goOnline()
        backend.syncNow()

        // Assert
        assertEquals("Написано в метро", backend.textOf(id))
        awaitUntil("пометка снялась") { !Sut.editor.value.isPending }
    }

    @Test
    fun `созданная без сети заметка доезжает до сервера`() = runTest(dispatcher) {
        // Arrange
        awaitUntil("список загрузился") { !Sut.list.value.isLoading }
        backend.goOffline()

        // Act
        Sut.createNote()
        awaitUntil("заметка создана на устройстве") { Sut.editor.value.noteId != null }
        Sut.onTitleChange("Из самолёта")
        Sut.onStopped()
        // Ждём именно заголовок: пометка «не отправлено» стоит на заметке с
        // момента создания и о том, что правка дошла до устройства, не говорит.
        awaitUntil("заголовок сохранён на устройстве") {
            Sut.list.value.notes.any { it.title == "Из самолёта" }
        }

        backend.goOnline()
        backend.syncNow()

        // Assert
        // Заметка появляется на сервере целиком, вместе с набранным заголовком:
        // создание и правка уехали в том порядке, в каком их сделали.
        awaitUntil("отправка завершилась") { backend.pendingCount() == 0 }
        assertTrue(
            "Созданная офлайн заметка должна появиться на сервере",
            backend.allTitles().contains("Из самолёта"),
        )
    }

    @Test
    fun `удаление без сети доезжает до сервера`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Лишняя", "Текст")
        val localId = openServerNote(id)
        backend.goOffline()

        // Act
        Sut.deleteNote(localId)
        awaitUntil("заметка пропала из списка") { Sut.list.value.notes.none { it.id == localId } }
        backend.goOnline()
        backend.syncNow()

        // Assert
        assertFalse("Удаление доезжает до сервера", backend.contains(id))
        assertEquals("Очередь пуста", 0, backend.pendingCount())
    }

    @Test
    fun `конфликт задним числом сохраняет правки и помечает заметку`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.goOffline()
        Sut.onTextChange("Моя правка из метро")
        Sut.onStopped()
        awaitUntil("правка помечена неотправленной") { Sut.editor.value.isPending }

        // Пока связи не было, заметку изменили с другого устройства.
        backend.editElsewhere(id, "Текст из другого места")

        // Act
        backend.goOnline()
        val conflicts = backend.syncNow()

        // Assert
        assertEquals(1, conflicts.size)
        assertEquals("Текст из другого места", backend.textOf(id))
        awaitUntil("заметка помечена конфликтной") { Sut.editor.value.hasConflict }
        assertEquals("Напечатанное остаётся у пользователя", "Моя правка из метро", Sut.editor.value.text)
    }

    @Test
    fun `конфликтная заметка больше не отправляется сама`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Заголовок", "Исходный текст")
        openServerNote(id)
        backend.goOffline()
        Sut.onTextChange("Моя правка из метро")
        Sut.onStopped()
        awaitUntil("правка помечена неотправленной") { Sut.editor.value.isPending }
        backend.editElsewhere(id, "Текст из другого места")
        backend.goOnline()
        backend.syncNow()
        awaitUntil("заметка помечена конфликтной") { Sut.editor.value.hasConflict }
        val attemptsBefore = backend.updates.size

        // Act
        val conflicts = backend.syncNow()

        // Assert
        // Повторять отклонённое бессмысленно, пока пользователь не решил.
        assertTrue(conflicts.isEmpty())
        assertEquals(attemptsBefore, backend.updates.size)
    }

    @Test
    fun `подгрузка следующей страницы не стирает заметки`() = runTest(dispatcher) {
        // Arrange
        backend.addNote("Первая", "Текст")
        backend.addNote("Вторая", "Текст")
        Sut.refresh()
        awaitUntil("список приехал") { Sut.list.value.notes.size == 2 }

        // Act
        // За концом списка сервер отдаёт пустую страницу — и она не значит,
        // что заметок больше нет.
        Sut.loadNextPage()
        awaitUntil("подгрузка завершилась") { Sut.list.value.endReached }

        // Assert
        assertEquals(2, Sut.list.value.notes.size)
    }

    @Test
    fun `список заметок виден без сети`() = runTest(dispatcher) {
        // Arrange
        backend.addNote("Первая", "Текст")
        backend.addNote("Вторая", "Текст")
        awaitUntil("список приехал") { Sut.list.value.notes.size == 2 }

        // Act
        backend.goOffline()
        Sut.refresh()
        awaitUntil("обновление завершилось") { !Sut.list.value.isRefreshing }

        // Assert
        // Неудачное обновление ничего не стирает: на экране остаётся то, что
        // лежит на устройстве.
        assertEquals(2, Sut.list.value.notes.size)
    }
}
