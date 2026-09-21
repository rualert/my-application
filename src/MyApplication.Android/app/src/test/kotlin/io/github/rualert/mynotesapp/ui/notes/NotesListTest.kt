package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Список заметок: создание, удаление и то, куда приложение попадает после них. */
class NotesListTest : NotesViewModelTestBase() {

    @Test
    fun `новая заметка открывается с курсором в заголовке`() = runTest(dispatcher) {
        // Arrange
        awaitUntil("список загрузился") { !Sut.list.value.isLoading }

        // Act
        Sut.createNote()
        awaitUntil("заметка создана и открыта") { Sut.editor.value.noteId != null }

        // Assert
        assertEquals(EditorFocus.Title, Sut.editor.value.pendingFocus)
        assertFalse("Новая заметка сразу показывается на экране", Sut.showList.value)
        // Заголовка у новой заметки нет — он появится, когда его напечатают.
        assertNull(Sut.editor.value.title.takeIf { it.isNotEmpty() })
    }

    @Test
    fun `удаление возвращает к списку и открывает соседнюю заметку`() = runTest(dispatcher) {
        // Arrange
        val older = backend.addNote("Старая", "Текст старой")
        val newer = backend.addNote("Новая", "Текст новой")
        Sut.loadFirstPage()
        awaitUntil("список загрузился") { Sut.list.value.notes.size == 2 }
        val newerLocalId = openServerNote(newer)
        val olderLocalId = backend.localIdOf(older)!!

        // Act
        Sut.deleteNote(newerLocalId)
        awaitUntil("открылась соседняя заметка") { Sut.editor.value.noteId == olderLocalId }

        // Assert
        assertTrue("После удаления приложение возвращает к списку", Sut.showList.value)
        assertEquals(listOf(olderLocalId), Sut.list.value.notes.map { it.id })
    }

    @Test
    fun `удаление последней заметки не оставляет открытой заметки`() = runTest(dispatcher) {
        // Arrange
        val only = backend.addNote("Единственная", "Текст")
        Sut.loadFirstPage()
        awaitUntil("список загрузился") { Sut.list.value.notes.size == 1 }
        val localId = openServerNote(only)

        // Act
        Sut.deleteNote(localId)
        awaitUntil("список опустел") { Sut.list.value.notes.isEmpty() }
        awaitUntil("удаление уехало на сервер") { !backend.contains(only) }

        // Assert
        assertNull(Sut.editor.value.noteId)
        assertFalse(backend.contains(only))
    }

    @Test
    fun `правки сохранённой заметки попадают в список`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Старый заголовок", "Текст")
        Sut.loadFirstPage()
        awaitUntil("список загрузился") { Sut.list.value.notes.isNotEmpty() }
        val localId = openServerNote(id)

        // Act
        Sut.onTitleChange("Новый заголовок")
        Sut.onStopped()
        awaitUntil("заголовок обновился в списке") {
            Sut.list.value.notes.first { it.id == localId }.title == "Новый заголовок"
        }
        awaitUntil("правка уехала на сервер") { backend.titleOf(id) == "Новый заголовок" }

        // Assert
        assertEquals("Новый заголовок", backend.titleOf(id))
    }
}
