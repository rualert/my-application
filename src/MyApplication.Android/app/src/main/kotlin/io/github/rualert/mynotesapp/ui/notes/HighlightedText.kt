package io.github.rualert.mynotesapp.ui.notes

import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import io.github.rualert.mynotesapp.domain.HighlightedSegment

/**
 * Текст результата поиска: отрезки с `match` выделены фоном.
 *
 * Разметка приходит с сервера — найденное по опечатке слово клиент подсветить
 * сам бы не смог (см. [io.github.rualert.mynotesapp.domain.NoteSearchResult]).
 */
@Composable
fun HighlightedText(
    segments: List<HighlightedSegment>,
    modifier: Modifier = Modifier,
    style: TextStyle = LocalTextStyle.current,
    color: Color = Color.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
) {
    val matchStyle = SpanStyle(
        background = MaterialTheme.colorScheme.tertiaryContainer,
        color = MaterialTheme.colorScheme.onTertiaryContainer,
    )

    val text: AnnotatedString = buildAnnotatedString {
        segments.forEach { segment ->
            if (segment.match) {
                withStyle(matchStyle) { append(segment.text) }
            } else {
                append(segment.text)
            }
        }
    }

    Text(
        text = text,
        style = style,
        color = color,
        maxLines = maxLines,
        overflow = TextOverflow.Ellipsis,
        modifier = modifier,
    )
}
