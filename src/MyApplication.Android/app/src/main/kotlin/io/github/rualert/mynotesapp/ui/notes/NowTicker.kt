package io.github.rualert.mynotesapp.ui.notes

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.produceState
import kotlinx.coroutines.delay
import java.time.Instant

/**
 * «Сейчас», обновляемое раз в полминуты, — от него зависит статус сохранения
 * («Сохранение: N минут назад»).
 *
 * Живёт на экране, а не в [NotesViewModel]: это чисто отображение, и вечный
 * цикл в ViewModel мешал бы тестам — виртуальное время в них прокручивается
 * «до простоя», которого у бесконечного таймера не бывает.
 */
@Composable
fun rememberNow(tickMillis: Long = TICK_MILLIS): State<Instant> =
    produceState(initialValue = Instant.now()) {
        while (true) {
            delay(tickMillis)
            value = Instant.now()
        }
    }

private const val TICK_MILLIS = 30_000L
