package io.github.rualert.mynotesapp.ui.notes.harness

import io.github.rualert.mynotesapp.ui.notes.NotesViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Before

/**
 * Общая обвязка сценариев вокруг [NotesViewModel].
 *
 * Время здесь виртуальное — иначе каждая проверка автосохранения ждала бы
 * настоящие пять секунд, — а вот запросы к [NotesTestBackend] выполняются
 * по-настоящему, на своих потоках. Поэтому ожидание ответа — это [awaitUntil],
 * а не прокрутка часов.
 */
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
        backend.close()
        Dispatchers.resetMain()
    }

    /**
     * Ждёт выполнения условия, давая работать и виртуальному времени, и
     * настоящему вводу-выводу.
     *
     * Часы при этом **не переводятся вперёд** ([TestCoroutineScheduler.runCurrent],
     * а не `advanceUntilIdle`). Причин две: в [NotesViewModel] крутится вечный
     * таймер статуса сохранения, на котором прокрутка «до простоя» зависла бы
     * навсегда, и, что важнее для смысла проверок, прокрутка вперёд сама
     * запускала бы отложенное сохранение — тогда проверка «таймер не
     * сдвигается при дальнейшем наборе» проходила бы и с debounce.
     */
    protected suspend fun TestScope.awaitUntil(description: String, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + REAL_TIMEOUT_MILLIS
        while (!condition()) {
            if (System.currentTimeMillis() > deadline) {
                throw AssertionError("Не дождались: $description")
            }

            testScheduler.runCurrent()
            withContext(Dispatchers.Default) { delay(REAL_POLL_MILLIS) }
        }

        testScheduler.runCurrent()
    }

    /** Открывает заметку и дожидается, когда она окажется в редакторе. */
    protected suspend fun TestScope.openAndAwait(id: String) {
        Sut.open(id)
        awaitUntil("заметка $id открылась") { Sut.editor.value.noteId == id && !Sut.editor.value.isLoading }
    }

    protected companion object {
        const val AUTOSAVE_DELAY_MILLIS = 5_000L
        private const val REAL_TIMEOUT_MILLIS = 10_000L
        private const val REAL_POLL_MILLIS = 5L
    }
}
