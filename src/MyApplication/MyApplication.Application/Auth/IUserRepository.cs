using MyApplication.Domain.Auth;

namespace MyApplication.Application.Auth;

/// <summary>
///     Порт для хранения пользователей — реализуется в слое Infrastructure.
/// </summary>
public interface IUserRepository
{
    /// <summary>
    ///     Добавляет пользователя в контекст хранения (без сохранения — см. <see cref="SaveChangesAsync"/>).
    /// </summary>
    Task AddAsync(User user, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает пользователя по идентификатору его профиля Google, либо
    ///     <c>null</c>, если такого пользователя ещё нет.
    /// </summary>
    Task<User?> GetByGoogleSubjectIdAsync(string googleSubjectId, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает пользователя по идентификатору, либо <c>null</c>, если он не найден.
    /// </summary>
    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    ///     Сохраняет все изменения, сделанные через <see cref="AddAsync"/> или
    ///     мутацию пользователя, полученного через <see cref="GetByGoogleSubjectIdAsync"/>
    ///     либо <see cref="GetByIdAsync"/>.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
