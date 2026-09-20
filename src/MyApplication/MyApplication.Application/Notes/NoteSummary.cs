namespace MyApplication.Application.Notes;

/// <summary>
///     Краткие сведения о заметке для списка — без текста. <paramref name="Title"/> — <c>null</c>,
///     если у заметки нет заголовка.
/// </summary>
public record NoteSummary(Guid Id, string? Title, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
