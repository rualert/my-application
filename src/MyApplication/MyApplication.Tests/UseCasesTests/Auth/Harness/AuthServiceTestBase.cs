using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using MyApplication.Application.Auth;
using MyApplication.Application.Notes;
using MyApplication.Infrastructure.Auth;
using MyApplication.Infrastructure.Notes;

namespace MyApplication.Tests.UseCasesTests.Auth.Harness;

/// <summary>
///     Базовый класс для тестов use case'ов фичи «Auth». Поднимает
///     <see cref="IAuthService"/> поверх настоящих <see cref="UserRepository"/>,
///     <see cref="RefreshTokenRepository"/>, <see cref="AuthDbContext"/> (EF Core
///     InMemory) и настоящего <see cref="JwtTokenGenerator"/> — подменяется
///     только <see cref="IGoogleIdTokenValidator"/> (см. <see cref="FakeGoogleIdTokenValidator"/>),
///     единственная легитимная внешняя граница. Реакция на регистрацию —
///     настоящий <see cref="WelcomeNoteRegistrationHandler"/> поверх настоящих
///     <see cref="NoteService"/>/<see cref="NoteRepository"/>/<see cref="NotesDbContext"/>
///     (тоже InMemory), а не заглушка: иначе тесты не заметили бы, что приветственная
///     заметка на самом деле не создаётся.
/// </summary>
public abstract class AuthServiceTestBase : IDisposable
{
    private readonly AuthDbContext _context;
    private readonly NotesDbContext _notesContext;

    protected AuthServiceTestBase()
    {
        var options = new DbContextOptionsBuilder<AuthDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _context = new AuthDbContext(options);

        var notesOptions = new DbContextOptionsBuilder<NotesDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _notesContext = new NotesDbContext(notesOptions);
        Notes = new NoteService(new NoteRepository(_notesContext));

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
            new JwtTokenGenerator(configuration),
            new WelcomeNoteRegistrationHandler(Notes));
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
    ///     Сервис заметок поверх той же базы заметок, куда пишет реакция на
    ///     регистрацию, — через него тесты смотрят, что регистрация оставила.
    /// </summary>
    protected INoteService Notes { get; }

    /// <summary>
    ///     Достаёт идентификатор пользователя из выданного access token'а (claim
    ///     <see cref="ClaimTypes.NameIdentifier"/> — тот же, из которого его берёт
    ///     <c>NotesController</c>): единственный публичный способ узнать, кому
    ///     принадлежат его заметки.
    /// </summary>
    protected static Guid UserIdOf(AuthResult result)
    {
        var token = new JwtSecurityTokenHandler().ReadJwtToken(result.AccessToken);
        return Guid.Parse(token.Claims.Single(claim => claim.Type == ClaimTypes.NameIdentifier).Value);
    }

    /// <summary>
    ///     Освобождает контексты EF Core вместе с их in-memory базами данных теста.
    /// </summary>
    public void Dispose()
    {
        _context.Dispose();
        _notesContext.Dispose();
    }
}
