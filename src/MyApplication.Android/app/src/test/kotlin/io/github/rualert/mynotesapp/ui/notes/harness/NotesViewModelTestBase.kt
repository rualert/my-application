package io.github.rualert.mynotesapp.ui.notes.harness

import androidx.lifecycle.viewModelScope
import io.github.rualert.mynotesapp.ui.notes.NotesViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/**
 * Общая обвязка сценариев вокруг [NotesViewModel].
 *
 * Время здесь виртуальное — иначе каждая проверка автосохранения ждала бы
 * настоящие пять секунд, — а вот запросы к [NotesTestBackend] выполняются
 * по-настоящему, на своих потоках. Поэтому ожидание ответа — это [awaitUntil],
 * а не прокрутка часов.
 */
@RunWith(RobolectricTestRunner::class)
abstract class NotesViewModelTestBase {

    /** Общие часы теста: их же использует `runTest`, поэтому время одно на всех. */
    protected val dispatcher = StandardTestDispatcher()

    protected lateinit var backend: NotesTestBackend
    protected lateinit var Sut: NotesViewModel

    @Before
    fun setUpViewModel() {
        // Корутины ViewModel выполняются сразу, а не ждут, пока тест отпустит
        // диспетчер: тело теста само занимает его почти всё время, и с
        // StandardTestDispatcher запросы не успевали даже начаться. Время при
        // этом остаётся виртуальным — задержка автосохранения по-прежнему
        // управляется `advanceTimeBy`, а не настоящими пятью секундами.
        Dispatchers.setMain(UnconfinedTestDispatcher(dispatcher.scheduler))
        backend = NotesTestBackend()
        Sut = NotesViewModel(
            repository = backend.repository,
            autosaveDelayMillis = AUTOSAVE_DELAY_MILLIS,
        )
    }

    @After
    fun tearDownViewModel() {
        // Порядок важен: ViewModel наблюдает за базой, поэтому её корутины
        // нужно остановить раньше, чем база закроется.
        Sut.viewModelScope.cancel()
        backend.close()
        Dispatchers.resetMain()
    }

    /** См. [awaitCondition]. */
    protected suspend fun TestScope.awaitUntil(
        description: String,
        diagnostics: () -> String = { "" },
        condition: () -> Boolean,
    ) = awaitCondition(description, diagnostics, condition)

    /** Открывает заметку и дожидается, когда она окажется в редакторе. */
    protected suspend fun TestScope.openAndAwait(id: String) {
        Sut.open(id)
        awaitUntil("заметка $id открылась") { Sut.editor.value.noteId == id && !Sut.editor.value.isLoading }
    }

    /**
     * Открывает заметку, которую сервер знает под [serverId].
     *
     * Интерфейс оперирует только локальными идентификаторами, поэтому сначала
     * нужно дождаться, пока список приедет с сервера на устройство.
     *
     * @return локальный идентификатор открытой заметки.
     */
    protected suspend fun TestScope.openServerNote(serverId: String): String {
        // Заметку на сервере обычно заводят уже после запуска приложения,
        // когда список оно загрузить успело: просим обновление явно, иначе
        // ждать её появления на устройстве можно бесконечно.
        Sut.refresh()
        awaitUntil("заметка $serverId приехала на устройство") { backend.localIdOf(serverId) != null }
        val localId = backend.localIdOf(serverId)!!
        openAndAwait(localId)
        return localId
    }

    protected companion object {
        const val AUTOSAVE_DELAY_MILLIS = 5_000L
    }
}
