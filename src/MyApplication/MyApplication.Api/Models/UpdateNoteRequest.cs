namespace MyApplication.Api.Models;

/// <summary>
///     Тело запроса на обновление заголовка и текста заметки.
/// </summary>
public record UpdateNoteRequest(string Title, string Text);
