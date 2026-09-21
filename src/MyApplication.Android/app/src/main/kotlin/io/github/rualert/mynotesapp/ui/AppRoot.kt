package io.github.rualert.mynotesapp.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.rualert.mynotesapp.appContainer
import io.github.rualert.mynotesapp.data.auth.SessionState
import io.github.rualert.mynotesapp.ui.auth.AuthViewModel
import io.github.rualert.mynotesapp.ui.auth.LoginScreen
import io.github.rualert.mynotesapp.ui.notes.NotesScreen

/**
 * Корень приложения: какой экран показан, решает состояние сессии. Пока она
 * восстанавливается, не показывается ни экран входа, ни заметки — иначе при
 * каждом запуске мелькала бы кнопка входа уже вошедшему пользователю.
 */
@Composable
fun AppRoot(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val container = remember(context) { context.appContainer }
    val viewModel: AuthViewModel = viewModel(factory = AuthViewModel.factory(container))

    val session by viewModel.session.collectAsStateWithLifecycle()
    val isSigningIn by viewModel.isSigningIn.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()

    Surface(
        modifier = modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background,
    ) {
        when (val current = session) {
            SessionState.Restoring -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator()
            }

            SessionState.LoggedOut -> LoginScreen(
                isSigningIn = isSigningIn,
                errorMessage = errorMessage,
                onSignIn = { viewModel.signIn(context) },
            )

            SessionState.Unavailable -> UnavailableScreen(onRetry = viewModel::restoreSession)

            // ViewModel заметок принадлежат сессии, а не активити: см.
            // AuthViewModel.sessionViewModels.
            is SessionState.LoggedIn -> CompositionLocalProvider(
                LocalViewModelStoreOwner provides viewModel.sessionViewModels,
            ) {
                NotesScreen(
                    userName = current.userName,
                    onLogout = viewModel::logout,
                )
            }
        }
    }
}
