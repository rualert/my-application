package io.github.rualert.mynotesapp.ui.notes

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import io.github.rualert.mynotesapp.appContainer

/**
 * Заметки на телефоне: список и открытая заметка не делят экран, а сменяют
 * друг друга. Возврат к списку — системная «Назад» и стрелка в тулбаре.
 */
@Composable
fun NotesScreen(
    userName: String,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val container = remember(context) { context.appContainer }
    val viewModel: NotesViewModel = viewModel(factory = NotesViewModel.factory(container))

    val list by viewModel.list.collectAsStateWithLifecycle()
    val editor by viewModel.editor.collectAsStateWithLifecycle()
    val showList by viewModel.showList.collectAsStateWithLifecycle()
    val now by rememberNow()

    val listState = rememberLazyListState()

    // Уход приложения в фон — основной способ его покинуть, и система вправе
    // выгрузить его из памяти, не спросив: несохранённое отправляем здесь.
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_STOP) {
                viewModel.onStopped()
            }
        }

        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    BackHandler(enabled = !showList) { viewModel.backToList() }

    if (showList) {
        NotesListScreen(
            userName = userName,
            state = list,
            openNoteId = editor.noteId,
            onOpen = viewModel::open,
            onCreate = viewModel::createNote,
            onRefresh = viewModel::refresh,
            onLoadMore = viewModel::loadNextPage,
            onLogout = onLogout,
            modifier = modifier,
            listState = listState,
        )
    } else {
        NoteEditorScreen(
            state = editor,
            now = now,
            onBack = viewModel::backToList,
            onTitleChange = viewModel::onTitleChange,
            onTextChange = viewModel::onTextChange,
            onToggleMode = viewModel::toggleMode,
            onDelete = { editor.noteId?.let(viewModel::deleteNote) },
            onFocusHandled = viewModel::onFocusHandled,
            onReloadFromServer = viewModel::reloadFromServer,
            onOverwriteWithMine = viewModel::overwriteWithMine,
            modifier = modifier,
        )
    }
}
