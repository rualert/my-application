package io.github.rualert.mynotesapp.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.rualert.mynotesapp.AppContainer
import io.github.rualert.mynotesapp.data.notes.NotesRepository
import io.github.rualert.mynotesapp.domain.Note
import io.github.rualert.mynotesapp.domain.NoteSearchResult
import io.github.rualert.mynotesapp.domain.NoteSummary
import io.github.rualert.mynotesapp.domain.titleForRequest
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Clock
import java.time.Instant

/** Что показано в области заметки: поля для правки или отрисованный Markdown. */
enum class EditorMode { Edit, View }

/** Куда поставить курсор, когда поля появятся на экране. */
enum class EditorFocus { Title, Text }

data class NotesListState(
    val notes: List<NoteSummary> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val endReached: Boolean = false,
    val error: String? = null,
)

/**
 * Поиск по заметкам. [hasSearched] отличает «ещё не искали» от «искали и не
 * нашли»: иначе «Ничего не найдено» мелькало бы до первого ответа сервера.
 */
data class NotesSearchState(
    val isActive: Boolean = false,
    val query: String = "",
    val results: List<NoteSearchResult> = emptyList(),
    val isSearching: Boolean = false,
    val hasSearched: Boolean = false,
    val error: String? = null,
)

data class NoteEditorState(
    val noteId: String? = null,
    val isLoading: Boolean = false,
    val loadError: String? = null,
    val title: String = "",
    val text: String = "",
    val mode: EditorMode = EditorMode.Edit,
    val isSaving: Boolean = false,
    val lastSavedAt: Instant? = null,
    /** Правка лежит на устройстве и ждёт отправки. */
    val isPending: Boolean = false,
    val hasConflict: Boolean = false,
    val pendingFocus: EditorFocus? = null,
)

/**
 * Список заметок и открытая заметка.
 *
 * Автосохранение устроено так же, как в веб-интерфейсе
 * (docs/docs/notes/web-ui.md, «Сохранение заметок»): таймер запускает **первая**
 * правка после сохранения и дальнейший набор его не сдвигает, поэтому при
 * непрерывной печати запрос уходит примерно раз в пять секунд. Плюс
 * немедленное сохранение при уходе с заметки и при уходе приложения в фон.
 */
class NotesViewModel(
    private val repository: NotesRepository,
    private val clock: Clock = Clock.systemUTC(),
    private val autosaveDelayMillis: Long = AUTOSAVE_DELAY_MILLIS,
    private val searchDebounceMillis: Long = SEARCH_DEBOUNCE_MILLIS,
) : ViewModel() {

    private val _list = MutableStateFlow(NotesListState())
    val list: StateFlow<NotesListState> = _list.asStateFlow()

    private val _editor = MutableStateFlow(NoteEditorState())
    val editor: StateFlow<NoteEditorState> = _editor.asStateFlow()

    private val _search = MutableStateFlow(NotesSearchState())
    val search: StateFlow<NotesSearchState> = _search.asStateFlow()

    /** Какая панель занимает экран: список или заметка. */
    private val _showList = MutableStateFlow(true)
    val showList: StateFlow<Boolean> = _showList.asStateFlow()

    /** Серверная копия открытой заметки: с ней сверяется черновик. */
    private var savedTitle = ""
    private var savedText = ""
    private var version = 0

    private var saveTimer: Job? = null
    private var loadJob: Job? = null
    private var searchJob: Job? = null
    private val saveMutex = Mutex()

    init {
        // Список берётся с устройства и обновляется сам: и после правки, и
        // после того, как отправка в фоне принесла серверные изменения.
        viewModelScope.launch {
            repository.observeNotes().collect { notes ->
                _list.update { it.copy(notes = notes, isLoading = false) }

                // Отправка идёт в фоне, и статус открытой заметки меняется без
                // участия экрана: «Не отправлено» должно гаснуть само.
                _editor.update { state ->
                    val openNote = notes.firstOrNull { it.id == state.noteId }
                    if (openNote == null) state else state.copy(isPending = openNote.isPending)
                }
            }
        }

        // Открытую заметку сервер мог изменить, пока её правили офлайн: сюда
        // приходит признак конфликта, выставленный отправкой в фоне.
        viewModelScope.launch {
            repository.observeConflicts().collect { conflicted ->
                _editor.update { state ->
                    if (state.noteId != null && state.noteId in conflicted) {
                        state.copy(hasConflict = true)
                    } else {
                        state
                    }
                }
            }
        }

        refresh()
    }

    // ------------------------------------------------------------------ список

    fun loadFirstPage() = refresh()

    fun refresh() {
        _list.update { it.copy(isRefreshing = true, error = null) }
        viewModelScope.launch {
            // Неудача — это обычный офлайн, а не ошибка: на экране остаётся
            // то, что лежит на устройстве.
            repository.refresh()
            _list.update { it.copy(isRefreshing = false, isLoading = false) }
        }
    }

    fun loadNextPage() {
        val state = _list.value
        if (state.isLoading || state.isRefreshing || state.endReached) {
            return
        }

        viewModelScope.launch {
            val loaded = state.notes.size
            repository.loadMore(from = loaded)
            _list.update { it.copy(endReached = _list.value.notes.size == loaded) }
        }
    }

    fun createNote() {
        flushSave()
        viewModelScope.launch {
            // Создание не ходит на сервер: заметка появляется на устройстве
            // сразу и уезжает, когда будет связь.
            val note = repository.createNote()
            showNote(note, focus = EditorFocus.Title)
            _showList.value = false
        }
    }

    fun deleteNote(id: String) {
        viewModelScope.launch {
            val neighbour = neighbourOf(id)
            repository.deleteNote(id)

            if (_editor.value.noteId == id) {
                // Правки удалённой заметки сохранять некуда.
                cancelPendingSave()
                _editor.value = NoteEditorState(mode = _editor.value.mode)
                neighbour?.let { open(it.id) }
                // Удаление всегда возвращает к списку, даже если соседняя
                // заметка открылась в области редактирования.
                _showList.value = true
            }
        }
    }

    /** Следующая заметка после удаляемой, а если она была последней — предыдущая. */
    private fun neighbourOf(id: String): NoteSummary? {
        val notes = _list.value.notes
        val index = notes.indexOfFirst { it.id == id }
        if (index < 0) {
            return null
        }

        return notes.getOrNull(index + 1) ?: notes.getOrNull(index - 1)
    }

    // ------------------------------------------------------------------- поиск

    fun openSearch() {
        _search.value = NotesSearchState(isActive = true)
    }

    /** Уйти из поиска, ничего не выбрав: заметка остаётся прежней. */
    fun closeSearch() {
        searchJob?.cancel()
        searchJob = null
        _search.value = NotesSearchState()
    }

    fun onSearchQueryChange(query: String) {
        searchJob?.cancel()

        if (query.length < MIN_SEARCH_QUERY_LENGTH) {
            // Сервер такой запрос отвергает, да и искать по одной букве
            // бессмысленно: ничего не показываем и ничего не спрашиваем.
            _search.update {
                it.copy(
                    query = query,
                    results = emptyList(),
                    isSearching = false,
                    hasSearched = false,
                    error = null,
                )
            }
            return
        }

        _search.update { it.copy(query = query, error = null) }

        searchJob = viewModelScope.launch {
            // Запрос на каждое нажатие клавиши не нужен: набирают быстрее,
            // чем отвечает сервер.
            delay(searchDebounceMillis)

            // `isSearching` означает именно «запрос в пути», а не «пользователь
            // что-то печатает»: иначе «Идёт поиск…» мигало бы на каждой букве,
            // да и проверить паузу было бы нечем.
            _search.update { if (it.query == query) it.copy(isSearching = true) else it }

            runCatching { repository.search(query) }
                .onSuccess { results ->
                    _search.update { state ->
                        if (state.query != query) {
                            // Пока искали, текст успели изменить — эта выдача уже не о том.
                            state
                        } else {
                            state.copy(results = results, isSearching = false, hasSearched = true)
                        }
                    }
                }
                .onFailure { failure ->
                    _search.update { state ->
                        if (state.query != query) {
                            state
                        } else {
                            state.copy(isSearching = false, error = failure.userMessage())
                        }
                    }
                }
        }
    }

    /** Выбор результата: заметка открывается, поиск закрывается — один шаг. */
    fun openFromSearch(id: String) {
        closeSearch()
        open(id)
    }

    // ----------------------------------------------------------------- заметка

    fun open(id: String) {
        if (_editor.value.noteId == id) {
            _showList.value = false
            return
        }

        // Правки предыдущей заметки уезжают на сервер сами по себе: заставлять
        // пользователя ждать ответа PUT, чтобы открыть другую заметку, нельзя.
        flushSave()

        _showList.value = false
        _editor.value = NoteEditorState(noteId = id, isLoading = true, mode = _editor.value.mode)
        resetSavedCopy()

        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            val stored = repository.noteById(id)

            // Список приходит без текстов, поэтому у заметки, которую ещё ни
            // разу не открывали, текста на устройстве нет. Показывать пустоту
            // вместо него нельзя — она неотличима от пустой заметки.
            val needsText = stored != null && stored.text.isEmpty() && stored.version == 0
            if (stored != null && !needsText) {
                if (_editor.value.noteId == id) showNote(stored, focus = null)
            }

            if (needsText) {
                repository.ensureText(id)
            }

            repository.noteById(id)?.let { note ->
                if (_editor.value.noteId == id && !isDirty()) showNote(note, focus = null)
            }

            if (_editor.value.noteId == id && _editor.value.isLoading) {
                // Текст догрузить не вышло (скорее всего нет сети) — показываем
                // то, что есть, а не бесконечную загрузку.
                _editor.update { it.copy(isLoading = false) }
            }
        }
    }

    /** Есть ли в редакторе правки, которых нет в сохранённой копии. */
    private fun isDirty(): Boolean {
        val state = _editor.value
        return state.title != savedTitle || state.text != savedText
    }

    fun backToList() {
        flushSave()
        _showList.value = true
    }

    fun onTitleChange(value: String) {
        _editor.update { it.copy(title = value) }
        scheduleSave()
    }

    fun onTextChange(value: String) {
        _editor.update { it.copy(text = value) }
        scheduleSave()
    }

    fun toggleMode() {
        // Уход из полей — это потеря фокуса, а она сохраняет сразу.
        flushSave()
        _editor.update {
            it.copy(mode = if (it.mode == EditorMode.Edit) EditorMode.View else EditorMode.Edit)
        }
    }

    fun onFocusHandled() {
        _editor.update { it.copy(pendingFocus = null) }
    }

    /** Приложение уходит в фон: система вправе выгрузить его, не спросив. */
    fun onStopped() {
        flushSave()
    }

    // --------------------------------------------------------------- сохранение

    private fun scheduleSave() {
        if (saveTimer?.isActive == true) {
            return
        }

        saveTimer = viewModelScope.launch {
            delay(autosaveDelayMillis)
            saveNow()
        }
    }

    /** Сохранить сейчас же, не дожидаясь таймера и не дожидаясь ответа сервера. */
    private fun flushSave() {
        cancelPendingSave()
        val pending = pendingSave() ?: return
        viewModelScope.launch { saveMutex.withLock { perform(pending) } }
    }

    private fun cancelPendingSave() {
        saveTimer?.cancel()
        saveTimer = null
    }

    /**
     * Сохранения идут строго по одному: два параллельных PUT могли бы дойти до
     * сервера не в том порядке, и более старая версия затёрла бы свежую.
     * Черновик читается уже внутри очереди, поэтому в запрос попадает
     * последнее напечатанное, а не то, что было в момент постановки в очередь.
     */
    private suspend fun saveNow() {
        saveMutex.withLock {
            val pending = pendingSave() ?: return
            perform(pending)
        }
    }

    /**
     * Снимок черновика для отправки. Отсутствие снимка значит «сохранять
     * нечего»: заметка не открыта, ничего не изменилось с последнего
     * сохранения либо разбирается конфликт.
     */
    private fun pendingSave(): PendingSave? {
        val state = _editor.value
        val id = state.noteId ?: return null
        if (state.hasConflict || (state.title == savedTitle && state.text == savedText)) {
            return null
        }

        return PendingSave(id, state.title, state.text)
    }

    /**
     * Сохранение на устройстве не может не удаться: сеть на него не влияет.
     * Отправкой занимается фоновая синхронизация, поэтому ни ошибок, ни
     * конфликта здесь не бывает — конфликт придёт позже, из [observeConflicts].
     */
    private suspend fun perform(request: PendingSave) {
        _editor.update { if (it.noteId == request.id) it.copy(isSaving = true) else it }

        repository.saveDraft(request.id, titleForRequest(request.title), request.text)

        if (_editor.value.noteId == request.id) {
            savedTitle = request.title
            savedText = request.text
            _editor.update { it.copy(isSaving = false, lastSavedAt = clock.instant()) }
        }
    }

    private data class PendingSave(
        val id: String,
        val title: String,
        val text: String,
    )

    /** Конфликт: отказаться от своих правок в пользу серверной версии. */
    fun reloadFromServer() {
        val id = _editor.value.noteId ?: return
        viewModelScope.launch {
            repository.reloadFromServer(id)
                .onSuccess {
                    repository.noteById(id)?.let { note ->
                        if (_editor.value.noteId == id) showNote(note, focus = null)
                    }
                }
                .onFailure { failure -> _editor.update { it.copy(loadError = failure.userMessage()) } }
        }
    }

    /** Конфликт: оставить своё — правки снова встают в очередь на отправку. */
    fun overwriteWithMine() {
        val id = _editor.value.noteId ?: return
        viewModelScope.launch {
            repository.overwriteWithMine(id)
                .onSuccess {
                    if (_editor.value.noteId == id) {
                        _editor.update { it.copy(hasConflict = false) }
                    }
                }
                .onFailure { failure -> _editor.update { it.copy(loadError = failure.userMessage()) } }
        }
    }

    // ------------------------------------------------------------ вспомогательное

    /**
     * Показывает уже полученную заметку.
     *
     * Какая панель на экране, здесь не решается намеренно: ответ сервера
     * приходит позже нажатия, и после удаления, которое возвращает к списку,
     * загрузка соседней заметки утащила бы пользователя обратно в редактор.
     */
    private fun showNote(note: Note, focus: EditorFocus?) {
        savedTitle = note.title.orEmpty()
        savedText = note.text
        version = note.version

        _editor.value = NoteEditorState(
            noteId = note.id,
            title = savedTitle,
            text = savedText,
            mode = _editor.value.mode,
            lastSavedAt = null,
            pendingFocus = focus,
        )
    }

    private fun resetSavedCopy() {
        savedTitle = ""
        savedText = ""
        version = 0
    }

    private fun patchSummary(note: Note) {
        _list.update { state ->
            state.copy(
                notes = state.notes.map { summary ->
                    if (summary.id == note.id) {
                        summary.copy(title = note.title, updatedAt = note.updatedAt)
                    } else {
                        summary
                    }
                },
            )
        }
    }

    private fun Note.toSummary() = NoteSummary(id, title, createdAt, updatedAt)

    private fun Throwable.userMessage(): String = message ?: "Не удалось связаться с сервером."

    companion object {
        const val AUTOSAVE_DELAY_MILLIS = 5_000L
        const val SEARCH_DEBOUNCE_MILLIS = 300L
        const val MIN_SEARCH_QUERY_LENGTH = 3
        private const val PAGE_SIZE = 50

        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { NotesViewModel(container.notesRepository) }
        }
    }
}
