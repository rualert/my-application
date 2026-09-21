package io.github.rualert.mynotesapp.ui.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import com.mikepenz.markdown.m3.Markdown
import io.github.rualert.mynotesapp.R
import io.github.rualert.mynotesapp.domain.hasTitle
import java.time.Instant

/**
 * Открытая заметка: заголовок первой строкой, ниже текст, внизу статус
 * сохранения. Режим просмотра отрисовывает текст как Markdown и не даёт его
 * править.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteEditorScreen(
    state: NoteEditorState,
    now: Instant,
    onBack: () -> Unit,
    onTitleChange: (String) -> Unit,
    onTextChange: (String) -> Unit,
    onToggleMode: () -> Unit,
    onDelete: () -> Unit,
    onFocusHandled: () -> Unit,
    onReloadFromServer: () -> Unit,
    onOverwriteWithMine: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var askingToDelete by remember { mutableStateOf(false) }
    val titleFocus = remember { FocusRequester() }
    val textFocus = remember { FocusRequester() }

    // Курсор в новую заметку можно поставить только когда поля уже на экране,
    // а заметка создаётся раньше, чем открывается, — поэтому намерение ждёт.
    LaunchedEffect(state.noteId, state.pendingFocus, state.mode) {
        if (state.mode != EditorMode.Edit || state.pendingFocus == null) {
            return@LaunchedEffect
        }

        when (state.pendingFocus) {
            EditorFocus.Title -> titleFocus.requestFocus()
            EditorFocus.Text -> textFocus.requestFocus()
        }
        onFocusHandled()
    }

    Scaffold(
        // Клавиатура не должна закрывать поле, в котором стоит курсор.
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = stringResource(R.string.back_to_list),
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { askingToDelete = true }, enabled = state.noteId != null) {
                        Icon(Icons.Default.Delete, contentDescription = stringResource(R.string.delete_note))
                    }
                    IconButton(onClick = onToggleMode, enabled = state.noteId != null) {
                        if (state.mode == EditorMode.Edit) {
                            Icon(
                                Icons.AutoMirrored.Filled.List,
                                contentDescription = stringResource(R.string.switch_to_view),
                            )
                        } else {
                            Icon(
                                Icons.Default.Edit,
                                contentDescription = stringResource(R.string.switch_to_edit),
                            )
                        }
                    }
                },
            )
        },
        bottomBar = {
            Text(
                text = saveStatusText(state.isSaving, state.lastSavedAt, now),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                // Статус сохранения виден всегда и не прячется за системной
                // полосой жестов (docs/docs/notes/web-ui.md, «Размеры и попадание пальцем»).
                modifier = Modifier
                    .fillMaxWidth()
                    .navigationBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when {
                state.isLoading -> CircularProgressIndicator(Modifier.align(Alignment.Center))

                state.loadError != null -> Text(
                    text = state.loadError,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(horizontal = 32.dp),
                )

                state.noteId == null -> Text(
                    text = stringResource(R.string.note_not_selected),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.Center),
                )

                else -> Column(modifier = Modifier.fillMaxSize()) {
                    if (state.hasConflict) {
                        ConflictBanner(
                            onReloadFromServer = onReloadFromServer,
                            onOverwriteWithMine = onOverwriteWithMine,
                        )
                    }

                    if (state.mode == EditorMode.Edit) {
                        NoteFields(
                            state = state,
                            titleFocus = titleFocus,
                            textFocus = textFocus,
                            onTitleChange = onTitleChange,
                            onTextChange = onTextChange,
                        )
                    } else {
                        NotePreview(state = state)
                    }
                }
            }
        }
    }

    if (askingToDelete) {
        AlertDialog(
            onDismissRequest = { askingToDelete = false },
            title = { Text(stringResource(R.string.delete_note_question)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        askingToDelete = false
                        onDelete()
                    },
                ) {
                    Text(stringResource(R.string.delete))
                }
            },
            dismissButton = {
                TextButton(onClick = { askingToDelete = false }) {
                    Text(stringResource(R.string.cancel))
                }
            },
        )
    }
}

@Composable
private fun NoteFields(
    state: NoteEditorState,
    titleFocus: FocusRequester,
    textFocus: FocusRequester,
    onTitleChange: (String) -> Unit,
    onTextChange: (String) -> Unit,
) {
    val transparentFieldColors = TextFieldDefaults.colors(
        focusedContainerColor = MaterialTheme.colorScheme.surface,
        unfocusedContainerColor = MaterialTheme.colorScheme.surface,
    )

    TextField(
        value = state.title,
        onValueChange = onTitleChange,
        placeholder = { Text(stringResource(R.string.note_title_hint)) },
        textStyle = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
        singleLine = true,
        colors = transparentFieldColors,
        // Заголовок ведёт себя как первая строка текста: Enter уводит курсор
        // в текст, а не начинает новую строку заголовка.
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
        keyboardActions = KeyboardActions(onNext = { textFocus.requestFocus() }),
        modifier = Modifier
            .fillMaxWidth()
            .focusRequester(titleFocus),
    )

    TextField(
        value = state.text,
        onValueChange = onTextChange,
        textStyle = MaterialTheme.typography.bodyLarge,
        colors = transparentFieldColors,
        modifier = Modifier
            .fillMaxSize()
            .focusRequester(textFocus),
    )
}

@Composable
private fun NotePreview(state: NoteEditorState) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (hasTitle(state.title)) {
            Text(
                text = state.title,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
        } else {
            Text(
                text = stringResource(R.string.untitled),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Markdown(content = state.text)
    }
}

/**
 * Предупреждение о конфликте. Напечатанное пользователем при этом остаётся в
 * редакторе: выбор, чьи правки оставить, делает он, а не приложение.
 */
@Composable
private fun ConflictBanner(
    onReloadFromServer: () -> Unit,
    onOverwriteWithMine: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(
            text = stringResource(R.string.conflict_title),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.error,
        )

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onReloadFromServer) {
                Text(stringResource(R.string.conflict_reload))
            }
            OutlinedButton(onClick = onOverwriteWithMine) {
                Text(stringResource(R.string.conflict_overwrite))
            }
        }
    }
}
