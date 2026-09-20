package io.github.rualert.mynotesapp.ui.auth

import android.content.Context
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import io.github.rualert.mynotesapp.BuildConfig

/** Идентификатор клиента Google не задан при сборке — см. README. */
class MissingGoogleClientIdException : IllegalStateException("Не задан myNotesApp.googleServerClientId")

/** Диалог выбора аккаунта Google вернул что-то, кроме ID token. */
class UnexpectedCredentialException(type: String) : IllegalStateException("Неожиданный тип учётных данных: $type")

/**
 * Просит у системы Google ID token — тот самый, который потом проверяет
 * `POST /Auth/google`.
 *
 * `serverClientId` — идентификатор **веб-клиента**, того же, с которым работает
 * веб-интерфейс: сервер сверяет `aud` токена именно с ним
 * (`GoogleIdTokenValidator`), так что никакой отдельной настройки на стороне
 * API для Android не нужно. Приложению при этом нужен собственный OAuth-клиент
 * типа Android в том же проекте Google Cloud — по нему Google сверяет подпись
 * APK, но в токен он не попадает.
 */
object GoogleSignIn {

    suspend fun requestIdToken(context: Context): String {
        val serverClientId = BuildConfig.GOOGLE_SERVER_CLIENT_ID
        if (serverClientId.isBlank()) {
            throw MissingGoogleClientIdException()
        }

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(GetSignInWithGoogleOption.Builder(serverClientId).build())
            .build()

        val credential = CredentialManager.create(context).getCredential(context, request).credential
        if (credential !is CustomCredential ||
            credential.type != GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            throw UnexpectedCredentialException(credential.type)
        }

        return GoogleIdTokenCredential.createFrom(credential.data).idToken
    }
}
