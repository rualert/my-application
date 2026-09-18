using MyApplication.Domain.Notes;

namespace MyApplication.Application.Notes;

/// <summary>
///     Порт для хранения заметок — реализуется в слое Infrastructure.
/// </summary>
public interface INoteRepository
{
    /// <summary>
    ///     Добавляет заметку в контекст хранения (без сохранения — см. <see cref="SaveChangesAsync"/>).
    /// </summary>
    Task AddAsync(Note note, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает заметку по идентификатору, либо <c>null</c>, если она не найдена.
    /// </summary>
    Task<Note?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает страницу заметок пользователя <paramref name="userId"/>,
    ///     отсортированных от новых к старым: пропускает первые
    ///     <paramref name="from"/> заметок и возвращает не более
    ///     <paramref name="count"/> следующих.
    /// </summary>
    Task<IReadOnlyList<Note>> GetAllAsync(Guid userId, int from, int count, CancellationToken cancellationToken);

    /// <summary>
    ///     Помечает заметку на удаление (без сохранения — см. <see cref="SaveChangesAsync"/>).
    /// </summary>
    void Remove(Note note);

    /// <summary>
    ///     Сохраняет все изменения, сделанные через <see cref="AddAsync"/>/<see cref="Remove"/>
    ///     или мутацию заметки, полученной через <see cref="GetByIdAsync"/>.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
