namespace MyApplication.Api.Models;

/// <summary>
///     Отрезок строки в результате поиска: отрезки идут подряд, склеив их
///     <paramref name="Text"/>, клиент получает строку целиком, а отрезки с
///     <paramref name="Match"/> — это места совпадений, которые нужно выделить.
/// </summary>
public record HighlightedSegmentResponse(string Text, bool Match);
