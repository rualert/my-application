package io.github.rualert.mynotesapp.ui.notes

import io.github.rualert.mynotesapp.domain.joinText
import io.github.rualert.mynotesapp.ui.notes.harness.NotesViewModelTestBase
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Поиск по заметкам — docs/docs/notes/android.md, раздел «Поиск». */
class NotesSearchTest : NotesViewModelTestBase() {

    @Test
    fun `запрос короче трёх символов на сервер не уходит`() = runTest(dispatcher) {
        // Arrange
        Sut.openSearch()

        // Act
        Sut.onSearchQueryChange("за")
        testScheduler.advanceTimeBy(SEARCH_DEBOUNCE_MILLIS * 4)
        testScheduler.runCurrent()

        // Assert
        // Сервер такой запрос отвергает с 400 — спрашивать его незачем.
        assertTrue(backend.searchQueries.isEmpty())
        assertFalse(Sut.search.value.isSearching)
    }

    @Test
    fun `найденное показывается с разметкой совпадений`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Список покупок", "не забыть про покупки на выходные")
        backend.setSearchResults(
            listOf(backend.searchResult(id, "Список покупок", "…не забыть про ", "покупки", " на выходные…")),
        )
        awaitUntil("заметка приехала на устройство") { backend.localIdOf(id) != null }
        Sut.openSearch()

        // Act
        Sut.onSearchQueryChange("покупки")
        awaitUntil("пришли результаты") { Sut.search.value.results.isNotEmpty() }

        // Assert
        val result = Sut.search.value.results.single()
        // Сервер отвечает своими идентификаторами, наружу уходят локальные.
        assertEquals(backend.localIdOf(id), result.id)
        assertEquals("Список покупок", result.title.joinText())
        // Разметку считает сервер: заметку, найденную по опечатке, клиент сам
        // подсветить бы не смог.
        assertEquals(listOf("покупки"), result.snippet.filter { it.match }.map { it.text })
    }

    @Test
    fun `быстрый набор порождает один запрос`() = runTest(dispatcher) {
        // Arrange
        // Ответ на поиск придерживается: проверяется как раз состояние
        // «запрос ушёл и ещё не вернулся», а без задержки ответ успевал
        // прийти раньше, чем проверка на него посмотрит, — примерно один
        // прогон из пяти падал на ровном месте.
        backend.holdSearches()
        Sut.openSearch()

        // Act
        // Проверки — без единого приостановления теста: стоит ему уснуть,
        // как runTest прокрутит виртуальное время и пауза «истечёт» сама.
        Sut.onSearchQueryChange("пок")
        testScheduler.advanceTimeBy(SEARCH_DEBOUNCE_MILLIS / 2)
        testScheduler.runCurrent()
        val searchingWhileTyping = Sut.search.value.isSearching

        Sut.onSearchQueryChange("покуп")
        testScheduler.advanceTimeBy(SEARCH_DEBOUNCE_MILLIS / 2)
        testScheduler.runCurrent()
        Sut.onSearchQueryChange("покупки")
        testScheduler.advanceTimeBy(SEARCH_DEBOUNCE_MILLIS + 1)
        testScheduler.runCurrent()
        val searchingAfterPause = Sut.search.value.isSearching

        // Assert
        assertFalse("Пока набирают, запрос не уходит", searchingWhileTyping)
        assertTrue("После паузы запрос уходит", searchingAfterPause)

        backend.releaseSearches()
        awaitUntil("пришёл ответ") { !Sut.search.value.isSearching }
        // Ушёл ровно один запрос — с последним набранным текстом.
        assertEquals(listOf("покупки"), backend.searchQueries)
    }

    @Test
    fun `когда ничего не нашлось это видно`() = runTest(dispatcher) {
        // Arrange
        backend.setSearchResults(emptyList())
        Sut.openSearch()

        // Act
        Sut.onSearchQueryChange("такого нет")
        awaitUntil("пришёл ответ") { Sut.search.value.hasSearched }

        // Assert
        assertTrue(Sut.search.value.results.isEmpty())
        assertFalse("До ответа сервера «ничего не найдено» показывать рано", Sut.search.value.isSearching)
    }

    @Test
    fun `выбор результата открывает заметку и закрывает поиск`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Список покупок", "не забыть про покупки")
        backend.setSearchResults(listOf(backend.searchResult(id, "Список покупок", "", "покупки", "")))
        awaitUntil("заметка приехала на устройство") { backend.localIdOf(id) != null }
        Sut.openSearch()
        Sut.onSearchQueryChange("покупки")
        awaitUntil("пришли результаты") { Sut.search.value.results.isNotEmpty() }

        // Act
        // В выдаче приходит серверный идентификатор, а наружу репозиторий
        // отдаёт локальный — интерфейс знает заметки только по нему.
        val localId = backend.localIdOf(id)!!
        Sut.openFromSearch(Sut.search.value.results.single().id)
        awaitUntil("заметка открылась") { Sut.editor.value.noteId == localId && !Sut.editor.value.isLoading }

        // Assert
        assertFalse("Выбор в один шаг: поиск закрывается сразу", Sut.search.value.isActive)
        assertEquals("не забыть про покупки", Sut.editor.value.text)
        assertFalse("Открытая заметка занимает экран", Sut.showList.value)
    }

    @Test
    fun `выход из поиска ничего не выбирает`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Список покупок", "не забыть про покупки")
        backend.setSearchResults(listOf(backend.searchResult(id, "Список покупок", "", "покупки", "")))
        Sut.openSearch()
        Sut.onSearchQueryChange("покупки")
        awaitUntil("пришли результаты") { Sut.search.value.results.isNotEmpty() }

        // Act
        Sut.closeSearch()

        // Assert
        assertFalse(Sut.search.value.isActive)
        assertEquals("", Sut.search.value.query)
        assertTrue(Sut.search.value.results.isEmpty())
        assertEquals(null, Sut.editor.value.noteId)
        assertTrue("Остаёмся в списке", Sut.showList.value)
    }

    @Test
    fun `опоздавший ответ не подменяет выдачу для нового запроса`() = runTest(dispatcher) {
        // Arrange
        val id = backend.addNote("Список покупок", "покупки")
        backend.setSearchResults(listOf(backend.searchResult(id, "Список покупок", "", "покупки", "")))
        Sut.openSearch()

        // Act
        Sut.onSearchQueryChange("покупки")
        testScheduler.advanceTimeBy(SEARCH_DEBOUNCE_MILLIS + 1)
        testScheduler.runCurrent()
        // Пока ответ в пути, пользователь стёр запрос до двух символов.
        Sut.onSearchQueryChange("по")
        awaitUntil("состояние устоялось") { !Sut.search.value.isSearching }

        // Assert
        assertTrue("Для короткого запроса выдачи быть не должно", Sut.search.value.results.isEmpty())
        assertEquals("по", Sut.search.value.query)
    }

    private companion object {
        const val SEARCH_DEBOUNCE_MILLIS = NotesViewModel.SEARCH_DEBOUNCE_MILLIS
    }
}
