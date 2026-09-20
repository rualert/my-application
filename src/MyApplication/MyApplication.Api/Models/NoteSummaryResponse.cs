namespace MyApplication.Api.Models;

/// <summary>
///     Краткие сведения о заметке для списка — без текста.
/// </summary>
public record NoteSummaryResponse(Guid Id, string? Title, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
