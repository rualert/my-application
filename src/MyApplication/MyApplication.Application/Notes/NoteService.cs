using MyApplication.Domain.Notes;

namespace MyApplication.Application.Notes;

public class NoteService : INoteService
{
    /// <summary>
    ///     Минимальная длина поискового запроса: по более короткому искать нечего.
    /// </summary>
    public const int MinQueryLength = 3;

    /// <summary>
    ///     Сколько заметок возвращает поиск. Ровно столько, сколько показывает
    ///     подсказка в поле поиска — постраничного просмотра совпадений нет.
    /// </summary>
    public const int MaxSearchResults = 10;

    private readonly INoteRepository _repository;

    /// <summary>
    ///     Создаёт сервис поверх переданного репозитория заметок.
    /// </summary>
    public NoteService(INoteRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    ///     Создаёт новую заметку от имени <paramref name="callerUserId"/>.
    /// </summary>
    /// <returns>Созданная заметка.</returns>
    /// <exception cref="ArgumentNullException">Текст заметки равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">Заголовок или текст не проходят валидацию.</exception>
    public async Task<NoteDetails> CreateAsync(Guid callerUserId, string? title, string text, CancellationToken cancellationToken)
    {
        var note = Note.Create(callerUserId, title, text);
        await _repository.AddAsync(note, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDetails(note);
    }

    /// <summary>
    ///     Возвращает страницу заметок пользователя <paramref name="callerUserId"/>
    ///     (без текста), отсортированных от новых к старым.
    /// </summary>
    /// <returns>Список кратких сведений о заметках.</returns>
    /// <exception cref="ApplicationException">
    ///     <paramref name="from"/> отрицательный, либо <paramref name="count"/> не положительный.
    /// </exception>
    public async Task<IReadOnlyList<NoteSummary>> GetAllAsync(Guid callerUserId, int from, int count, CancellationToken cancellationToken)
    {
        if (from < 0)
        {
            throw new ApplicationException("Параметр from не может быть отрицательным.");
        }

        if (count <= 0)
        {
            throw new ApplicationException("Параметр count должен быть положительным.");
        }

        var notes = await _repository.GetAllAsync(callerUserId, from, count, cancellationToken);
        return notes.Select(ToSummary).ToArray();
    }

    /// <summary>
    ///     Ищет <paramref name="query"/> среди заметок пользователя
    ///     <paramref name="callerUserId"/>.
    /// </summary>
    /// <returns>
    ///     Не более <see cref="MaxSearchResults"/> найденных заметок, от более
    ///     релевантных к менее.
    /// </returns>
    /// <exception cref="ApplicationException">
    ///     <paramref name="query"/> короче <see cref="MinQueryLength"/> символов.
    /// </exception>
    public async Task<IReadOnlyList<NoteSearchResult>> SearchAsync(Guid callerUserId, string query, CancellationToken cancellationToken)
    {
        var trimmedQuery = query?.Trim() ?? string.Empty;
        if (trimmedQuery.Length < MinQueryLength)
        {
            throw new ApplicationException($"Поисковый запрос должен быть не короче {MinQueryLength} символов.");
        }

        var notes = await _repository.SearchAsync(callerUserId, trimmedQuery, MaxSearchResults, cancellationToken);
        return notes.Select(note => ToSearchResult(note, trimmedQuery)).ToArray();
    }

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    /// <returns>Найденная заметка.</returns>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    public async Task<NoteDetails> GetByIdAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken)
    {
        var note = await GetOwnedNoteAsync(callerUserId, id, cancellationToken);
        return ToDetails(note);
    }

    /// <summary>
    ///     Обновляет заголовок и текст существующей заметки.
    /// </summary>
    /// <returns>Обновлённая заметка.</returns>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    /// <exception cref="ArgumentNullException">Текст заметки равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">Заголовок или текст не проходят валидацию.</exception>
    /// <exception cref="NoteConflictException">
    ///     Заметку изменили с версии <paramref name="expectedVersion"/>.
    /// </exception>
    public async Task<NoteDetails> UpdateAsync(Guid callerUserId, Guid id, string? title, string text, int expectedVersion, CancellationToken cancellationToken)
    {
        var note = await GetOwnedNoteAsync(callerUserId, id, cancellationToken);
        if (note.Version != expectedVersion)
        {
            throw new NoteConflictException(id, expectedVersion, note.Version);
        }

        note.Update(title, text);
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDetails(note);
    }

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="NoteAccessDeniedException">Заметка принадлежит другому пользователю.</exception>
    public async Task DeleteAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken)
    {
        var note = await GetOwnedNoteAsync(callerUserId, id, cancellationToken);
        _repository.Remove(note);
        await _repository.SaveChangesAsync(cancellationToken);
    }

    private async Task<Note> GetOwnedNoteAsync(Guid callerUserId, Guid id, CancellationToken cancellationToken)
    {
        var note = await _repository.GetByIdAsync(id, cancellationToken)
                   ?? throw new NoteNotFoundException(id);

        if (note.UserId != callerUserId)
        {
            throw new NoteAccessDeniedException(id);
        }

        return note;
    }

    private static NoteSummary ToSummary(Note note) => new(note.Id, note.Title, note.CreatedAt, note.UpdatedAt);

    private static NoteSearchResult ToSearchResult(Note note, string query) => new(
        note.Id,
        SearchSnippetBuilder.HighlightTitle(note.Title, query),
        SearchSnippetBuilder.BuildSnippet(note.Text, query));

    private static NoteDetails ToDetails(Note note) => new(note.Id, note.Title, note.Text, note.Version, note.CreatedAt, note.UpdatedAt);
}
