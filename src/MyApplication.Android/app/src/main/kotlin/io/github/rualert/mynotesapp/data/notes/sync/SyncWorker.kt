package io.github.rualert.mynotesapp.data.notes.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import io.github.rualert.mynotesapp.appContainer
import io.github.rualert.mynotesapp.data.notes.SyncScheduler

/**
 * Отправляет накопленные изменения, когда есть сеть.
 *
 * Работа переживает закрытие приложения и перезагрузку телефона — этим и
 * ценен WorkManager: правка, сделанная в метро, уходит на поверхности, даже
 * если приложение к тому моменту давно закрыли.
 */
class SyncWorker(
    context: Context,
    parameters: WorkerParameters,
) : CoroutineWorker(context, parameters) {

    override suspend fun doWork(): Result {
        val container = applicationContext.appContainer

        return try {
            val conflicts = container.notesSyncer.push()
            conflicts.forEach { conflict -> container.conflictNotifier.notifyConflict(conflict) }
            Result.success()
        } catch (failure: Exception) {
            // Сеть могла пропасть посреди отправки: очередь цела, попробуем позже.
            Result.retry()
        }
    }

    companion object {
        private const val UNIQUE_WORK = "notes-sync"

        fun scheduler(context: Context): SyncScheduler = SyncScheduler {
            val request = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(
                    Constraints.Builder()
                        .setRequiredNetworkType(NetworkType.CONNECTED)
                        .build(),
                )
                .build()

            // APPEND_OR_REPLACE, а не REPLACE: пока одна отправка идёт, новая
            // правка не должна её отменять — иначе при быстром наборе
            // изменения так и не доедут.
            WorkManager.getInstance(context).enqueueUniqueWork(
                UNIQUE_WORK,
                ExistingWorkPolicy.APPEND_OR_REPLACE,
                request,
            )
        }
    }
}
