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
    ///     Возвращает не более <paramref name="limit"/> заметок пользователя
    ///     <paramref name="userId"/>, в которых нашёлся <paramref name="query"/>,
    ///     от более релевантных к менее.
    ///     Запрос ищется целиком (как одна фраза) и в заголовке, и в тексте, без
    ///     учёта регистра; заметка находится и тогда, когда запрос набран с
    ///     опечатками — по похожести написания.
    ///     Порядок выдачи: сначала заметки с точным вхождением запроса в заголовке,
    ///     затем с точным вхождением в тексте, затем с похожим заголовком, затем с
    ///     похожим текстом; совпадения в обоих полях поднимают заметку выше, а при
    ///     равной релевантности выше идёт изменённая позже.
    /// </summary>
    Task<IReadOnlyList<Note>> SearchAsync(Guid userId, string query, int limit, CancellationToken cancellationToken);

    /// <summary>
    ///     Помечает заметку на удаление (без сохранения — см. <see cref="SaveChangesAsync"/>).
    /// </summary>
    void Remove(Note note);

    /// <summary>
    ///     Сохраняет все изменения, сделанные через <see cref="AddAsync"/>/<see cref="Remove"/>
    ///     или мутацию заметки, полученной через <see cref="GetByIdAsync"/>.
    /// </summary>
    /// <exception cref="NoteConflictException">
    ///     Заметку изменили между её чтением и сохранением — версия в хранилище
    ///     уже не та, что была прочитана.
    /// </exception>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
