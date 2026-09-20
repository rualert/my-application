namespace MyApplication.Api.Models;

/// <summary>
///     Тело запроса на обновление заголовка и текста заметки.
///     <paramref name="Title"/> необязателен: отсутствие, <c>null</c>, пустая строка или одни пробелы
///     означают «без заголовка».
/// </summary>
public record UpdateNoteRequest(string? Title, string Text);
