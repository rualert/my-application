package io.github.rualert.mynotesapp.ui.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.rualert.mynotesapp.AppContainer
import io.github.rualert.mynotesapp.data.notes.NoteConflictException
import io.github.rualert.mynotesapp.data.notes.NotesRepository
import io.github.rualert.mynotesapp.domain.Note
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

data class NoteEditorState(
    val noteId: String? = null,
    val isLoading: Boolean = false,
    val loadError: String? = null,
    val title: String = "",
    val text: String = "",
    val mode: EditorMode = EditorMode.Edit,
    val isSaving: Boolean = false,
    val lastSavedAt: Instant? = null,
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
) : ViewModel() {

    private val _list = MutableStateFlow(NotesListState())
    val list: StateFlow<NotesListState> = _list.asStateFlow()

    private val _editor = MutableStateFlow(NoteEditorState())
    val editor: StateFlow<NoteEditorState> = _editor.asStateFlow()

    /** Какая панель занимает экран: список или заметка. */
    private val _showList = MutableStateFlow(true)
    val showList: StateFlow<Boolean> = _showList.asStateFlow()

    /** Серверная копия открытой заметки: с ней сверяется черновик. */
    private var savedTitle = ""
    private var savedText = ""
    private var version = 0

    private var saveTimer: Job? = null
    private var loadJob: Job? = null
    private val saveMutex = Mutex()

    init {
        loadFirstPage()
    }

    // ------------------------------------------------------------------ список

    fun loadFirstPage() {
        _list.update { it.copy(isLoading = true, error = null) }
        viewModelScope.launch { loadPage(from = 0, replace = true) }
    }

    fun refresh() {
        _list.update { it.copy(isRefreshing = true, error = null) }
        viewModelScope.launch { loadPage(from = 0, replace = true) }
    }

    fun loadNextPage() {
        val state = _list.value
        if (state.isLoading || state.isRefreshing || state.endReached) {
            return
        }

        viewModelScope.launch { loadPage(from = state.notes.size, replace = false) }
    }

    private suspend fun loadPage(from: Int, replace: Boolean) {
        runCatching { repository.list(from, PAGE_SIZE) }
            .onSuccess { page ->
                _list.update { state ->
                    state.copy(
                        notes = if (replace) page else state.notes + page,
                        isLoading = false,
                        isRefreshing = false,
                        endReached = page.size < PAGE_SIZE,
                        error = null,
                    )
                }
            }
            .onFailure { failure ->
                _list.update { it.copy(isLoading = false, isRefreshing = false, error = failure.userMessage()) }
            }
    }

    fun createNote() {
        flushSave()
        viewModelScope.launch {
            runCatching { repository.create(title = null, text = "") }
                .onSuccess { note ->
                    _list.update { it.copy(notes = listOf(note.toSummary()) + it.notes) }
                    // Заметка только что получена целиком — перечитывать её незачем.
                    showNote(note, focus = EditorFocus.Title)
                    _showList.value = false
                }
                .onFailure { failure -> _list.update { it.copy(error = failure.userMessage()) } }
        }
    }

    fun deleteNote(id: String) {
        viewModelScope.launch {
            runCatching { repository.delete(id) }
                .onSuccess {
                    val remaining = _list.value.notes.filterNot { it.id == id }
                    val neighbour = neighbourOf(id)
                    _list.update { it.copy(notes = remaining) }

                    if (_editor.value.noteId == id) {
                        // Правки удалённой заметки сохранять некуда.
                        cancelPendingSave()
                        _editor.value = NoteEditorState(mode = _editor.value.mode)
                        neighbour?.let { open(it.id) }
                        // Удаление всегда возвращает к списку, даже если
                        // соседняя заметка открылась в области редактирования.
                        _showList.value = true
                    }
                }
                .onFailure { failure -> _list.update { it.copy(error = failure.userMessage()) } }
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
            runCatching { repository.byId(id) }
                .onSuccess { note -> if (_editor.value.noteId == id) showNote(note, focus = null) }
                .onFailure { failure ->
                    if (_editor.value.noteId == id) {
                        _editor.update { it.copy(isLoading = false, loadError = failure.userMessage()) }
                    }
                }
        }
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

        return PendingSave(id, state.title, state.text, version)
    }

    private suspend fun perform(request: PendingSave) {
        _editor.update { if (it.noteId == request.id) it.copy(isSaving = true) else it }

        runCatching {
            repository.update(request.id, titleForRequest(request.title), request.text, request.version)
        }
            .onSuccess { updated -> onSaved(request, updated) }
            .onFailure { failure -> onSaveFailed(request.id, failure) }

        _editor.update { if (it.noteId == request.id) it.copy(isSaving = false) else it }
    }

    private fun onSaved(request: PendingSave, updated: Note) {
        patchSummary(updated)

        if (_editor.value.noteId != request.id) {
            // Пока запрос летел, открыли другую заметку: её собственные
            // «сохранено» и версия к этому ответу отношения не имеют.
            return
        }

        savedTitle = request.title
        savedText = request.text
        version = updated.version
        _editor.update { it.copy(lastSavedAt = clock.instant()) }
    }

    private data class PendingSave(
        val id: String,
        val title: String,
        val text: String,
        val version: Int,
    )

    private fun onSaveFailed(id: String, failure: Throwable) {
        if (failure is NoteConflictException) {
            // Повторять тот же отклонённый запрос бессмысленно: пока
            // пользователь не решит, чьи правки оставить, автосохранение стоит.
            _editor.update { if (it.noteId == id) it.copy(hasConflict = true) else it }
            return
        }

        // Сервер недоступен: черновик остаётся несохранённым, и попытка
        // повторится — заметка сохранится сама, когда связь вернётся.
        scheduleSave()
    }

    fun reloadFromServer() {
        val id = _editor.value.noteId ?: return
        viewModelScope.launch {
            runCatching { repository.byId(id) }
                .onSuccess { note -> if (_editor.value.noteId == id) showNote(note, focus = null) }
                .onFailure { failure -> _editor.update { it.copy(loadError = failure.userMessage()) } }
        }
    }

    fun overwriteWithMine() {
        val id = _editor.value.noteId ?: return
        viewModelScope.launch {
            // Актуальная версия нужна только для того, чтобы сервер принял
            // запись: сам текст берётся из черновика пользователя.
            runCatching { repository.byId(id) }
                .onSuccess { note ->
                    if (_editor.value.noteId != id) {
                        return@onSuccess
                    }

                    savedTitle = note.title.orEmpty()
                    savedText = note.text
                    version = note.version
                    _editor.update { it.copy(hasConflict = false) }
                    saveNow()
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
        private const val PAGE_SIZE = 50

        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { NotesViewModel(container.notesRepository) }
        }
    }
}
