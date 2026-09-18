using MyApplication.Domain.Auth;

namespace MyApplication.Application.Auth;

/// <summary>
///     Порт для хранения refresh-токенов — реализуется в слое Infrastructure.
/// </summary>
public interface IRefreshTokenRepository
{
    /// <summary>
    ///     Добавляет refresh-токен в контекст хранения (без сохранения — см. <see cref="SaveChangesAsync"/>).
    /// </summary>
    Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken);

    /// <summary>
    ///     Возвращает refresh-токен по хэшу его значения, либо <c>null</c>, если он не найден.
    /// </summary>
    Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken);

    /// <summary>
    ///     Сохраняет все изменения, сделанные через <see cref="AddAsync"/> или
    ///     мутацию токена, полученного через <see cref="GetByTokenHashAsync"/>.
    /// </summary>
    Task SaveChangesAsync(CancellationToken cancellationToken);
}
