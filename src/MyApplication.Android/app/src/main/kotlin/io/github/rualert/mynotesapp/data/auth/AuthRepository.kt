package io.github.rualert.mynotesapp.data.auth

import io.github.rualert.mynotesapp.data.api.AuthApi
import io.github.rualert.mynotesapp.data.api.AuthResponse
import io.github.rualert.mynotesapp.data.api.GoogleLoginRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException
import java.io.IOException

/**
 * Сессия пользователя: вход через Google, её восстановление при запуске,
 * обновление по refresh-cookie и выход.
 */
class AuthRepository(
    private val api: AuthApi,
    private val tokens: TokenStore,
    private val cookies: SessionCookieJar,
) {

    private val _session = MutableStateFlow<SessionState>(SessionState.Restoring)
    val session: StateFlow<SessionState> = _session.asStateFlow()

    private val refreshMutex = Mutex()

    /**
     * Поднимает сохранённую cookie и обменивает её на свежий access-token.
     *
     * Если сохранять нечего (первый запуск, выход из аккаунта), запрос не
     * отправляется вовсе: на экран входа пользователь попадает сразу, а не
     * после заведомо безнадёжного обращения к серверу.
     */
    suspend fun restoreSession() {
        _session.value = SessionState.Restoring
        if (!cookies.restore()) {
            _session.value = SessionState.LoggedOut
            return
        }

        refreshSession(staleToken = null)
    }

    suspend fun loginWithGoogle(idToken: String) {
        applySession(api.loginWithGoogle(GoogleLoginRequest(idToken)))
    }

    suspend fun logout() {
        // Отозвать refresh-token на сервере полезно, но выход не должен
        // зависеть от доступности сети: локально сессия закрывается в любом случае.
        runCatching { api.logout() }
        endSession()
    }

    /**
     * Обменивает refresh-cookie на новый access-token.
     *
     * Неудачи здесь бывают двух разных сортов, и путать их нельзя.
     * `401` — сессии больше нет (token просрочен, отозван или уже использован
     * при ротации): сохранённые данные надо выбросить и показать экран входа.
     * Недоступность сервера (нет сети, таймаут, `5xx`) ничего не говорит о
     * сессии: cookie остаётся на месте, и пользователь вернётся к работе по
     * кнопке «Повторить», а не через повторный вход.
     *
     * @param staleToken токен, с которым вызывающая сторона получила `401`.
     * Если к моменту входа в критическую секцию токен уже сменился, значит
     * сессию обновил кто-то другой, и повторять запрос не нужно — иначе
     * параллельные `401` вызвали бы цепочку ротаций refresh-token.
     */
    suspend fun refreshSession(staleToken: String?): Boolean = refreshMutex.withLock {
        val currentToken = tokens.accessToken
        if (currentToken != null && currentToken != staleToken) {
            return true
        }

        try {
            applySession(api.refresh())
            true
        } catch (failure: HttpException) {
            if (failure.code() == HTTP_UNAUTHORIZED) endSession() else markUnavailable()
            false
        } catch (failure: IOException) {
            markUnavailable()
            false
        }
    }

    private fun applySession(response: AuthResponse) {
        tokens.accessToken = response.accessToken
        _session.value = SessionState.LoggedIn(response.userName)
    }

    private suspend fun endSession() {
        tokens.accessToken = null
        cookies.clear()
        _session.value = SessionState.LoggedOut
    }

    /**
     * Сервер недоступен. Уже вошедшего пользователя это с экрана не сгоняет:
     * сессия могла и не истечь, а неудавшийся запрос сообщит о себе сам.
     */
    private fun markUnavailable() {
        tokens.accessToken = null
        if (_session.value !is SessionState.LoggedIn) {
            _session.value = SessionState.Unavailable
        }
    }

    private companion object {
        const val HTTP_UNAUTHORIZED = 401
    }
}
