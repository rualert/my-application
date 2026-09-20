namespace MyApplication.Application.Notes;

/// <summary>
///     Отрезок строки в результате поиска. Отрезки идут подряд: склеив
///     <paramref name="Text"/> всех отрезков, получаем строку целиком.
///     <paramref name="Match"/> — это место совпадения с поисковым запросом,
///     которое клиенту нужно выделить.
/// </summary>
public record HighlightedSegment(string Text, bool Match);
