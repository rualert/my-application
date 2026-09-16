namespace MyApplication.Application.Notes;

/// <summary>
///     Заметка целиком, включая текст.
/// </summary>
public record NoteDetails(Guid Id, string Title, string Text, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
