namespace MyApplication.Api.Models;

/// <summary>
///     Заметка целиком, включая текст.
/// </summary>
public record NoteResponse(Guid Id, string Title, string Text, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
