package io.github.rualert.mynotesapp.ui.notes

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import io.github.rualert.mynotesapp.R
import io.github.rualert.mynotesapp.domain.NoteSearchResult
import io.github.rualert.mynotesapp.domain.NoteSummary
import io.github.rualert.mynotesapp.domain.hasTitle
import kotlinx.coroutines.flow.distinctUntilChanged

/**
 * Список заметок: от новых к старым, с подгрузкой по мере пролистывания и
 * обновлением жестом «потянуть вниз». Кнопка в тулбаре сменяет список
 * поиском — поле ввода во всю ширину и найденное вместо списка.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotesListScreen(
    userName: String,
    state: NotesListState,
    search: NotesSearchState,
    openNoteId: String?,
    onOpen: (String) -> Unit,
    onCreate: () -> Unit,
    onRefresh: () -> Unit,
    onLoadMore: () -> Unit,
    onLogout: () -> Unit,
    onOpenSearch: () -> Unit,
    onCloseSearch: () -> Unit,
    onSearchQueryChange: (String) -> Unit,
    onOpenFromSearch: (String) -> Unit,
    modifier: Modifier = Modifier,
    // Состояние прокрутки поднято наверх: иначе список забывал бы, где
    // пользователь остановился, на каждый уход к заметке и обратно.
    listState: LazyListState = rememberLazyListState(),
) {
    // Следующая страница запрашивается, когда до конца загруженного осталось
    // несколько строк, — чтобы список не дёргался на самом краю.
    LaunchedEffect(listState, state.notes.size) {
        snapshotFlow { listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0 }
            .distinctUntilChanged()
            .collect { lastVisible ->
                if (lastVisible >= state.notes.size - LOAD_MORE_THRESHOLD) {
                    onLoadMore()
                }
            }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        topBar = {
            if (search.isActive) {
                SearchTopBar(
                    query = search.query,
                    onQueryChange = onSearchQueryChange,
                    onClose = onCloseSearch,
                )
            } else {
                NotesTopBar(
                    userName = userName,
                    onOpenSearch = onOpenSearch,
                    onCreate = onCreate,
                    onLogout = onLogout,
                )
            }
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            if (search.isActive) {
                SearchResults(search = search, onOpen = onOpenFromSearch)
            } else {
                NotesList(
                    state = state,
                    listState = listState,
                    openNoteId = openNoteId,
                    onOpen = onOpen,
                    onRefresh = onRefresh,
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotesTopBar(
    userName: String,
    onOpenSearch: () -> Unit,
    onCreate: () -> Unit,
    onLogout: () -> Unit,
) {
    TopAppBar(
        title = { Text(text = userName, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        actions = {
            IconButton(onClick = onOpenSearch) {
                Icon(Icons.Default.Search, contentDescription = stringResource(R.string.search))
            }
            IconButton(onClick = onCreate) {
                Icon(Icons.Default.Add, contentDescription = stringResource(R.string.add_note))
            }
            IconButton(onClick = onLogout) {
                Icon(
                    Icons.AutoMirrored.Filled.ExitToApp,
                    contentDescription = stringResource(R.string.logout),
                )
            }
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchTopBar(
    query: String,
    onQueryChange: (String) -> Unit,
    onClose: () -> Unit,
) {
    val focusRequester = remember { FocusRequester() }

    // Поиск открывают, чтобы печатать: курсор и клавиатура нужны сразу.
    LaunchedEffect(Unit) { focusRequester.requestFocus() }

    TopAppBar(
        navigationIcon = {
            IconButton(onClick = onClose) {
                Icon(
                    Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = stringResource(R.string.search_close),
                )
            }
        },
        title = {
            TextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = { Text(stringResource(R.string.search)) },
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                colors = TextFieldDefaults.colors(
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                ),
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { onQueryChange("") }) {
                            Icon(
                                Icons.Default.Clear,
                                contentDescription = stringResource(R.string.search_clear),
                            )
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .focusRequester(focusRequester),
            )
        },
    )
}

@Composable
private fun SearchResults(
    search: NotesSearchState,
    onOpen: (String) -> Unit,
) {
    when {
        search.error != null -> CenteredMessage(search.error)

        search.isSearching -> CenteredMessage(stringResource(R.string.search_in_progress))

        // «Ничего не найдено» показывается только после ответа сервера: до
        // него неизвестно, есть что-то или нет.
        search.hasSearched && search.results.isEmpty() ->
            CenteredMessage(stringResource(R.string.search_nothing_found))

        else -> LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = WindowInsets.navigationBars.asPaddingValues(),
        ) {
            items(search.results, key = { it.id }) { result ->
                SearchResultRow(result = result, onClick = { onOpen(result.id) })
                HorizontalDivider()
            }
        }
    }
}

@Composable
private fun SearchResultRow(
    result: NoteSearchResult,
    onClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        if (result.title.isEmpty()) {
            // У заметки без заголовка сервер присылает пустой список отрезков.
            Text(
                text = stringResource(R.string.untitled),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        } else {
            HighlightedText(
                segments = result.title,
                style = MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.Medium),
                maxLines = 1,
            )
        }

        HighlightedText(
            segments = result.snippet,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotesList(
    state: NotesListState,
    listState: LazyListState,
    openNoteId: String?,
    onOpen: (String) -> Unit,
    onRefresh: () -> Unit,
) {
    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = onRefresh,
        modifier = Modifier.fillMaxSize(),
    ) {
        when {
            state.error != null && state.notes.isEmpty() -> CenteredMessage(state.error)

            state.notes.isEmpty() && !state.isLoading ->
                CenteredMessage(stringResource(R.string.notes_empty))

            // Последняя строка списка должна оставаться доступной пальцу,
            // а не прятаться за системной полосой жестов.
            else -> LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = WindowInsets.navigationBars.asPaddingValues(),
            ) {
                items(state.notes, key = { it.id }) { note ->
                    NoteRow(
                        note = note,
                        isOpen = note.id == openNoteId,
                        onClick = { onOpen(note.id) },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun NoteRow(
    note: NoteSummary,
    isOpen: Boolean,
    onClick: () -> Unit,
) {
    val background = if (isOpen) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        MaterialTheme.colorScheme.surface
    }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(background)
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (hasTitle(note.title)) {
            Text(
                text = note.title.orEmpty(),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        } else {
            // «Без названия» — это не данные, а подсказка: на сервере у такой
            // заметки заголовка нет вовсе.
            Text(
                text = stringResource(R.string.untitled),
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun CenteredMessage(text: String) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private const val LOAD_MORE_THRESHOLD = 5
