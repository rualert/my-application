namespace MyApplication.Application.Notes;

/// <summary>
///     Найденная заметка: её заголовок и фрагмент текста вокруг совпадения,
///     с отмеченными местами самих совпадений. Текста заметки целиком здесь
///     нет — за ним нужно отдельное обращение по <paramref name="Id"/>.
///     У заметки без заголовка <paramref name="Title"/> пуст.
/// </summary>
public record NoteSearchResult(
    Guid Id,
    IReadOnlyList<HighlightedSegment> Title,
    IReadOnlyList<HighlightedSegment> Snippet);
