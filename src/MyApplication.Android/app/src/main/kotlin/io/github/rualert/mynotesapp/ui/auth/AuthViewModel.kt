package io.github.rualert.mynotesapp.ui.auth

import android.content.Context
import androidx.annotation.StringRes
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import io.github.rualert.mynotesapp.AppContainer
import io.github.rualert.mynotesapp.R
import io.github.rualert.mynotesapp.data.auth.AuthRepository
import io.github.rualert.mynotesapp.data.auth.SessionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Вход, выход и восстановление сессии при запуске приложения.
 *
 * Токен у Google запрашивается через переданную функцию, а не напрямую:
 * системный диалог выбора аккаунта — внешняя зависимость, и подменять его в
 * тестах нужно так же, как `IGoogleIdTokenValidator` на сервере.
 */
class AuthViewModel(
    private val repository: AuthRepository,
    private val requestGoogleIdToken: suspend (Context) -> String,
) : ViewModel() {

    val session = repository.session

    private val _isSigningIn = MutableStateFlow(false)
    val isSigningIn: StateFlow<Boolean> = _isSigningIn.asStateFlow()

    private val _errorMessage = MutableStateFlow<Int?>(null)
    val errorMessage: StateFlow<Int?> = _errorMessage.asStateFlow()

    /**
     * Где живут ViewModel экранов вошедшего пользователя.
     *
     * Не хранилище активити: из него ViewModel заметок пережила бы выход, и
     * следующий вошедший увидел бы в редакторе черновик прошлого, а её
     * таймер автосохранения сработал бы уже после выхода. Это хранилище
     * очищается, как только сессия кончается, — а поворот экрана, как и
     * хранилище активити, переживает, потому что принадлежит этой ViewModel.
     */
    val sessionViewModels: ViewModelStoreOwner = object : ViewModelStoreOwner {
        override val viewModelStore = ViewModelStore()
    }

    init {
        viewModelScope.launch {
            session.collect { state ->
                if (state !is SessionState.LoggedIn) {
                    sessionViewModels.viewModelStore.clear()
                }
            }
        }

        restoreSession()
    }

    /** Повторяет попытку восстановить сессию — кнопка «Повторить» на экране «нет связи». */
    fun restoreSession() {
        viewModelScope.launch { repository.restoreSession() }
    }

    fun signIn(context: Context) {
        if (_isSigningIn.value) {
            return
        }

        viewModelScope.launch {
            _isSigningIn.value = true
            _errorMessage.value = null
            runCatching { repository.loginWithGoogle(requestGoogleIdToken(context)) }
                .onFailure { failure -> _errorMessage.value = messageFor(failure) }
            _isSigningIn.value = false
        }
    }

    fun logout() {
        viewModelScope.launch { repository.logout() }
    }

    override fun onCleared() {
        sessionViewModels.viewModelStore.clear()
    }

    @StringRes
    private fun messageFor(failure: Throwable): Int = when (failure) {
        // Пользователь закрыл диалог выбора аккаунта — это не ошибка,
        // но экран должен объяснить, почему ничего не произошло.
        is GetCredentialCancellationException -> R.string.login_cancelled
        is MissingGoogleClientIdException -> R.string.login_client_id_missing
        else -> R.string.login_failed
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory = viewModelFactory {
            initializer { AuthViewModel(container.authRepository, GoogleSignIn::requestIdToken) }
        }
    }
}
