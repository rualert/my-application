package io.github.rualert.mynotesapp.data.notes

/**
 * Просьба отправить накопленное. Отдельный интерфейс — потому что «когда
 * именно отправлять» решает система (WorkManager ждёт появления сети), а
 * хранилищу знать об этом незачем; в тестах здесь стоит прямой вызов
 * синхронизации.
 */
fun interface SyncScheduler {
    fun requestSync()
}
