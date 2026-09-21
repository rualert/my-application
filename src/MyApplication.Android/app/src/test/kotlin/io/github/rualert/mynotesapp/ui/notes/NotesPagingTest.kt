package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Список по страницам и то, как он хранится на устройстве: заметки не должны
 * пропадать оттуда только потому, что лежат дальше первой страницы, — иначе
 * без сети от длинного списка оставалось бы начало.
 */
class NotesPagingTest : NotesViewModelTestBase() {

    @Test
    fun `обновление не стирает с устройства заметки дальше первой страницы`() = runTest(dispatcher) {
        // Arrange
        awaitStartupRefresh()
        repeat(NOTES_ON_TWO_PAGES) { number -> backend.addNote("Заметка $number", "Текст") }
        Sut.refresh()
        awaitUntil("обновление завершилось") { !Sut.list.value.isRefreshing }
        // Следующую страницу ViewModel просит со смещения, равного длине
        // списка на экране, а он приезжает из базы с опозданием.
        awaitUntil("первая страница на экране") { Sut.list.value.notes.size == PAGE_SIZE }
        Sut.loadNextPage()
        awaitUntil("вторая страница загрузилась") { backend.localNoteCount() == NOTES_ON_TWO_PAGES }

        // Act
        Sut.refresh()
        awaitUntil("обновление завершилось") { !Sut.list.value.isRefreshing }

        // Assert
        assertEquals(NOTES_ON_TWO_PAGES, backend.localNoteCount())
    }

    @Test
    fun `обновление убирает заметку, удалённую в другом месте`() = runTest(dispatcher) {
        // Arrange
        awaitStartupRefresh()
        val kept = backend.addNote("Остаётся", "Текст")
        val deleted = backend.addNote("Удалена в другом месте", "Текст")
        Sut.refresh()
        awaitUntil("заметки приехали на устройство") {
            backend.localIdOf(kept) != null && backend.localIdOf(deleted) != null
        }
        awaitUntil("обновление завершилось") { !Sut.list.value.isRefreshing }
        backend.deleteElsewhere(deleted)

        // Act
        Sut.refresh()
        awaitUntil("обновление завершилось") { !Sut.list.value.isRefreshing }

        // Assert
        assertNull(backend.localIdOf(deleted))
        assertNotNull(backend.localIdOf(kept))
    }

    /**
     * Дожидается обновления, которое ViewModel запускает сама при создании.
     *
     * Признак «идёт обновление» у ViewModel один на все обновления сразу, и
     * первое, закончившись, гасит его, пока второе ещё в пути. На двух ядрах
     * CI первое и второе перекрывались, и тест проверял базу раньше, чем
     * обновление, ради которого он написан, успевало в неё записать.
     */
    private suspend fun TestScope.awaitStartupRefresh() {
        awaitUntil("первое обновление завершилось") { !Sut.list.value.isRefreshing }
    }

    private companion object {
        /** Размер страницы, которой приложение просит список у сервера. */
        const val PAGE_SIZE = 50
        const val NOTES_ON_TWO_PAGES = 60
    }
}
