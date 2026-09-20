package io.github.rualert.mynotesapp.data.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

/**
 * Хранит cookie сессии между запусками приложения. Данные лежат в приватном
 * каталоге приложения, доступном только ему самому, и не попадают в резервные
 * копии (`allowBackup=false` в манифесте).
 */
class CookieStorage(context: Context) {

    private val dataStore = context.applicationContext.sessionDataStore

    suspend fun read(): Set<String> = dataStore.data.first()[COOKIES_KEY].orEmpty()

    suspend fun write(cookies: Set<String>) {
        dataStore.edit { preferences -> preferences[COOKIES_KEY] = cookies }
    }

    suspend fun clear() {
        dataStore.edit { preferences -> preferences.remove(COOKIES_KEY) }
    }

    private companion object {
        val COOKIES_KEY = stringSetPreferencesKey("cookies")
    }
}
