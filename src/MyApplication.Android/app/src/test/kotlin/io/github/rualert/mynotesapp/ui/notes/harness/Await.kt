package io.github.rualert.mynotesapp.ui.notes.harness

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.withContext

/**
 * Ждёт выполнения условия, давая работать и виртуальному времени, и
 * настоящему вводу-выводу.
 *
 * Часы при этом **не переводятся вперёд** ([kotlinx.coroutines.test.TestCoroutineScheduler.runCurrent],
 * а не `advanceUntilIdle`). Причин две: в `NotesViewModel` крутится вечный
 * таймер статуса сохранения, на котором прокрутка «до простоя» зависла бы
 * навсегда, и, что важнее для смысла проверок, прокрутка вперёд сама
 * запускала бы отложенное сохранение — тогда проверка «таймер не
 * сдвигается при дальнейшем наборе» проходила бы и с debounce.
 *
 * @param diagnostics что показать, если ждать не дождались. Сообщение «не
 * дождались» само по себе не говорит, чего не хватило, а не всякое падение
 * воспроизводится там, где его можно посмотреть отладчиком.
 */
suspend fun TestScope.awaitCondition(
    description: String,
    diagnostics: () -> String = { "" },
    condition: () -> Boolean,
) {
    val deadline = System.currentTimeMillis() + REAL_TIMEOUT_MILLIS
    while (!condition()) {
        if (System.currentTimeMillis() > deadline) {
            throw AssertionError("Не дождались: $description ${diagnostics()}".trim())
        }

        testScheduler.runCurrent()
        withContext(Dispatchers.Default) { delay(REAL_POLL_MILLIS) }
    }

    testScheduler.runCurrent()
}

private const val REAL_TIMEOUT_MILLIS = 10_000L
private const val REAL_POLL_MILLIS = 5L
