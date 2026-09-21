package io.github.rualert.mynotesapp.data.notes.sync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import io.github.rualert.mynotesapp.MainActivity
import io.github.rualert.mynotesapp.R
import io.github.rualert.mynotesapp.data.notes.SyncConflict

/**
 * Сообщает о конфликте уведомлением.
 *
 * Ждать, пока пользователь сам откроет приложение, нельзя: правки сделаны
 * офлайн и отклонены задним числом, а в другом месте ту же заметку тем
 * временем продолжают править.
 */
class ConflictNotifier(private val context: Context) {

    fun notifyConflict(conflict: SyncConflict) {
        if (!canNotify()) {
            // Разрешения нет — конфликт всё равно виден в списке и в заметке.
            return
        }

        createChannel()

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_NOTE_ID, conflict.localId)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            conflict.localId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(context.getString(R.string.conflict_title))
            .setContentText(conflict.title ?: context.getString(R.string.untitled))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        NotificationManagerCompat.from(context).notify(conflict.localId.hashCode(), notification)
    }

    /**
     * Убирает уведомления, оставшиеся от прошлой сессии: в них заголовки
     * заметок, которых на устройстве уже нет, — и следующему пользователю
     * видеть их незачем.
     */
    fun cancelAll() {
        NotificationManagerCompat.from(context).cancelAll()
    }

    private fun canNotify(): Boolean = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED

    private fun createChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            context.getString(R.string.sync_channel_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        )

        NotificationManagerCompat.from(context).createNotificationChannel(channel)
    }

    companion object {
        const val EXTRA_NOTE_ID = "noteId"
        private const val CHANNEL_ID = "sync"
    }
}
