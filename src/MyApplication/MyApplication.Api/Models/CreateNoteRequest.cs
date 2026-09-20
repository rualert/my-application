namespace MyApplication.Api.Models;

/// <summary>
///     Тело запроса на создание заметки.
///     <paramref name="Title"/> необязателен: отсутствие, <c>null</c>, пустая строка или одни пробелы
///     означают «без заголовка».
/// </summary>
public record CreateNoteRequest(string? Title, string Text);
