using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyApplication.Application.Auth;
using MyApplication.Infrastructure.Auth;

namespace MyApplication.Tests.UseCasesTests.Auth.Harness;

/// <summary>
///     Базовый класс для тестов use case'ов фичи «Auth». Поднимает
///     <see cref="IAuthService"/> поверх настоящих <see cref="UserRepository"/>,
///     <see cref="RefreshTokenRepository"/>, <see cref="AuthDbContext"/> (EF Core
///     InMemory) и настоящего <see cref="JwtTokenGenerator"/> — подменяется
///     только <see cref="IGoogleIdTokenValidator"/> (см. <see cref="FakeGoogleIdTokenValidator"/>),
///     единственная легитимная внешняя граница.
/// </summary>
public abstract class AuthServiceTestBase : IDisposable
{
    private readonly AuthDbContext _context;

    protected AuthServiceTestBase()
    {
        var options = new DbContextOptionsBuilder<AuthDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new AuthDbContext(options);

        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Jwt:Issuer"] = "MyApplication.Tests",
                ["Jwt:Audience"] = "MyApplication.Tests",
                ["Jwt:SigningKey"] = "test-signing-key-at-least-32-bytes-long!",
                ["Jwt:AccessTokenLifetimeMinutes"] = "15",
            })
            .Build();

        GoogleValidator = new FakeGoogleIdTokenValidator();
        Sut = new AuthService(
            new UserRepository(_context),
            new RefreshTokenRepository(_context),
            GoogleValidator,
            new JwtTokenGenerator(configuration));
    }

    /// <summary>
    ///     Сервис под тестом — единственная точка входа, через которую тесты
    ///     сценариев обращаются к SUT (чёрный ящик, без обращения к деталям реализации).
    /// </summary>
    protected IAuthService Sut { get; }

    /// <summary>
    ///     Фейковый валидатор Google ID token — единственная разрешённая подмена
    ///     (см. класс). Тесты настраивают через него профиль/исход валидации.
    /// </summary>
    protected FakeGoogleIdTokenValidator GoogleValidator { get; }

    /// <summary>
    ///     Освобождает контекст EF Core вместе с его in-memory базой данных теста.
    /// </summary>
    public void Dispose()
    {
        _context.Dispose();
    }
}
