namespace MyApplication.Application.Notes;

/// <summary>
///     Краткие сведения о заметке для списка — без текста.
/// </summary>
public record NoteSummary(Guid Id, string Title, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
