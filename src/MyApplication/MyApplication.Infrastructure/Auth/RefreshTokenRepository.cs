using Microsoft.EntityFrameworkCore;
using MyApplication.Application.Auth;
using MyApplication.Domain.Auth;

namespace MyApplication.Infrastructure.Auth;

public class RefreshTokenRepository : IRefreshTokenRepository
{
    private readonly AuthDbContext _context;

    /// <summary>
    ///     Создаёт репозиторий поверх переданного контекста EF Core.
    /// </summary>
    public RefreshTokenRepository(AuthDbContext context)
    {
        _context = context;
    }

    /// <summary>
    ///     Добавляет refresh-токен в контекст EF Core (без сохранения).
    /// </summary>
    public async Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken)
    {
        await _context.RefreshTokens.AddAsync(refreshToken, cancellationToken);
    }

    /// <summary>
    ///     Возвращает refresh-токен по хэшу его значения, либо <c>null</c>, если он не найден.
    /// </summary>
    public Task<RefreshToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken)
    {
        return _context.RefreshTokens.SingleOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);
    }

    /// <summary>
    ///     Сохраняет все изменения контекста EF Core в базе данных.
    /// </summary>
    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
