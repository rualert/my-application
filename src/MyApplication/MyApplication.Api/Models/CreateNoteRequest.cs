namespace MyApplication.Api.Models;

/// <summary>
///     Тело запроса на создание заметки.
/// </summary>
public record CreateNoteRequest(string Title, string Text);
