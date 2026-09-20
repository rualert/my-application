namespace MyApplication.Api.Models;

/// <summary>
///     Найденная заметка: размеченный заголовок и фрагмент текста вокруг
///     совпадения. Текста заметки целиком здесь нет — за ним нужен отдельный
///     запрос заметки по <paramref name="Id"/>. У заметки без заголовка
///     <paramref name="Title"/> пуст.
/// </summary>
public record NoteSearchResultResponse(
    Guid Id,
    IReadOnlyList<HighlightedSegmentResponse> Title,
    IReadOnlyList<HighlightedSegmentResponse> Snippet);
