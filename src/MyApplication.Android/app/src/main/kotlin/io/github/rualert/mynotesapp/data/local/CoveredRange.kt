package io.github.rualert.mynotesapp.data.local

/**
 * Промежуток дат создания (миллисекунды эпохи), открытый с обоих концов;
 * `null` у границы значит, что с этой стороны промежуток не ограничен.
 *
 * Концы исключены намеренно: даты на устройстве округлены до миллисекунд, а
 * на сервере точнее, и заметка с той же миллисекундой, что у крайней в
 * странице, вполне могла оказаться на соседней.
 */
data class CoveredRange(val after: Long?, val before: Long?) {

    operator fun contains(createdAt: Long): Boolean =
        (after == null || createdAt > after) && (before == null || createdAt < before)
}
