using Microsoft.EntityFrameworkCore;
using MyApplication.Application.Auth;
using MyApplication.Domain.Auth;

namespace MyApplication.Infrastructure.Auth;

public class UserRepository : IUserRepository
{
    private readonly AuthDbContext _context;

    /// <summary>
    ///     Создаёт репозиторий поверх переданного контекста EF Core.
    /// </summary>
    public UserRepository(AuthDbContext context)
    {
        _context = context;
    }

    /// <summary>
    ///     Добавляет пользователя в контекст EF Core (без сохранения).
    /// </summary>
    public async Task AddAsync(User user, CancellationToken cancellationToken)
    {
        await _context.Users.AddAsync(user, cancellationToken);
    }

    /// <summary>
    ///     Возвращает пользователя по идентификатору его профиля Google, либо
    ///     <c>null</c>, если такого пользователя ещё нет.
    /// </summary>
    public Task<User?> GetByGoogleSubjectIdAsync(string googleSubjectId, CancellationToken cancellationToken)
    {
        return _context.Users.SingleOrDefaultAsync(user => user.GoogleSubjectId == googleSubjectId, cancellationToken);
    }

    /// <summary>
    ///     Возвращает пользователя по идентификатору, либо <c>null</c>, если он не найден.
    /// </summary>
    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return _context.Users.SingleOrDefaultAsync(user => user.Id == id, cancellationToken);
    }

    /// <summary>
    ///     Сохраняет все изменения контекста EF Core в базе данных.
    /// </summary>
    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
