using MyApplication.Domain.Notes;

namespace MyApplication.Application.Notes;

public class NoteService : INoteService
{
    private readonly INoteRepository _repository;

    /// <summary>
    ///     Создаёт сервис поверх переданного репозитория заметок.
    /// </summary>
    public NoteService(INoteRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    ///     Создаёт новую заметку.
    /// </summary>
    /// <returns>Созданная заметка.</returns>
    /// <exception cref="ArgumentNullException">Текст заметки равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">Заголовок или текст не проходят валидацию.</exception>
    public async Task<NoteDetails> CreateAsync(string title, string text, CancellationToken cancellationToken)
    {
        var note = Note.Create(title, text);
        await _repository.AddAsync(note, cancellationToken);
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDetails(note);
    }

    /// <summary>
    ///     Возвращает список всех заметок (без текста).
    /// </summary>
    /// <returns>Список кратких сведений о заметках.</returns>
    public async Task<IReadOnlyList<NoteSummary>> GetAllAsync(CancellationToken cancellationToken)
    {
        var notes = await _repository.GetAllAsync(cancellationToken);
        return notes.Select(ToSummary).ToArray();
    }

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    /// <returns>Найденная заметка.</returns>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    public async Task<NoteDetails> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        var note = await _repository.GetByIdAsync(id, cancellationToken)
                   ?? throw new NoteNotFoundException(id);
        return ToDetails(note);
    }

    /// <summary>
    ///     Обновляет заголовок и текст существующей заметки.
    /// </summary>
    /// <returns>Обновлённая заметка.</returns>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    /// <exception cref="ArgumentNullException">Текст заметки равен <c>null</c>.</exception>
    /// <exception cref="NoteValidationException">Заголовок или текст не проходят валидацию.</exception>
    public async Task<NoteDetails> UpdateAsync(Guid id, string title, string text, CancellationToken cancellationToken)
    {
        var note = await _repository.GetByIdAsync(id, cancellationToken)
                   ?? throw new NoteNotFoundException(id);
        note.Update(title, text);
        await _repository.SaveChangesAsync(cancellationToken);
        return ToDetails(note);
    }

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <exception cref="NoteNotFoundException">Заметка с таким идентификатором не найдена.</exception>
    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken)
    {
        var note = await _repository.GetByIdAsync(id, cancellationToken)
                   ?? throw new NoteNotFoundException(id);
        _repository.Remove(note);
        await _repository.SaveChangesAsync(cancellationToken);
    }

    private static NoteSummary ToSummary(Note note) => new(note.Id, note.Title, note.CreatedAt, note.UpdatedAt);

    private static NoteDetails ToDetails(Note note) => new(note.Id, note.Title, note.Text, note.CreatedAt, note.UpdatedAt);
}
