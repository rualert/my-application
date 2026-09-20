using System.Security.Cryptography;
using MyApplication.Domain.Auth;

namespace MyApplication.Application.Auth;

public class AuthService : IAuthService
{
    private static readonly TimeSpan RefreshTokenLifetime = TimeSpan.FromDays(30);

    private readonly IUserRepository _userRepository;
    private readonly IRefreshTokenRepository _refreshTokenRepository;
    private readonly IGoogleIdTokenValidator _googleIdTokenValidator;
    private readonly IJwtTokenGenerator _jwtTokenGenerator;
    private readonly IUserRegistrationHandler _userRegistrationHandler;

    /// <summary>
    ///     Создаёт сервис аутентификации поверх переданных портов.
    /// </summary>
    public AuthService(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IGoogleIdTokenValidator googleIdTokenValidator,
        IJwtTokenGenerator jwtTokenGenerator,
        IUserRegistrationHandler userRegistrationHandler)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _googleIdTokenValidator = googleIdTokenValidator;
        _jwtTokenGenerator = jwtTokenGenerator;
        _userRegistrationHandler = userRegistrationHandler;
    }

    /// <summary>
    ///     Входит по Google ID token: находит существующего пользователя по
    ///     профилю Google либо создаёт нового (и сообщает об этом
    ///     <see cref="IUserRegistrationHandler"/> — сейчас он заводит новому
    ///     пользователю приветственную заметку), выдаёт новую пару токенов.
    /// </summary>
    /// <exception cref="InvalidGoogleTokenException">Токен Google невалиден.</exception>
    public async Task<AuthResult> LoginWithGoogleAsync(string googleIdToken, CancellationToken cancellationToken)
    {
        var googleUser = await _googleIdTokenValidator.ValidateAsync(googleIdToken, cancellationToken);

        var user = await _userRepository.GetByGoogleSubjectIdAsync(googleUser.Subject, cancellationToken);
        var isNewUser = user is null;
        if (user is null)
        {
            user = User.Create(googleUser.Subject, googleUser.Email, googleUser.Name);
            await _userRepository.AddAsync(user, cancellationToken);
        }
        else
        {
            user.UpdateProfile(googleUser.Email, googleUser.Name);
        }

        await _userRepository.SaveChangesAsync(cancellationToken);

        if (isNewUser)
        {
            // ОСОЗНАННОЕ РЕШЕНИЕ: регистрация пользователя и реакция на неё (сейчас —
            // приветственная заметка в фиче «Notes») НЕ атомарны и атомарными не должны
            // становиться без явного пересмотра этого решения.
            //
            // Пользователь уже сохранён (AuthDbContext), а заметка создаётся отдельным
            // сохранением в другом DbContext (NotesDbContext) — общей транзакции между ними
            // нет. Если создание заметки упадёт, вход завершится ошибкой (исключение не
            // глотается), но пользователь останется в базе: при следующем входе он уже
            // будет найден выше, ветка «новый пользователь» не повторится, и приветственной
            // заметки у него не будет никогда. Требование «после регистрации обязательно
            // есть приветственная заметка» здесь поэтому НЕ гарантируется.
            //
            // Почему мы с этим мирились:
            //  - Auth и Notes — независимые bounded context'ы (у каждого свой DbContext,
            //    ссылка Note.UserId на пользователя без FK). Общая транзакция склеила бы
            //    их в одну единицу работы и убила бы эту независимость; то, что сейчас оба
            //    контекста смотрят в одну физическую базу, — деталь развёртывания, а не
            //    повод на неё опираться.
            //  - Приветствие — вспомогательная часть, а не основа работы приложения: его
            //    отсутствие никому не мешает, а обойтись оно должно дешевле, чем стоит любой
            //    из механизмов гарантии.
            //  - Сбой здесь возможен, по сути, только если база недоступна — но тогда
            //    следующий шаг (сохранение refresh token) не удался бы в любом случае;
            //    окно, в котором проходит ровно одно из нескольких подряд идущих
            //    сохранений, крайне узкое.
            //  - Порядок «сначала пользователь, потом заметка» — естественный: заметка
            //    принадлежит уже существующему владельцу. Обратный («сначала заметка, потом
            //    пользователь») сохранял бы инвариант «есть пользователь — есть заметка»
            //    ценой заметок-сирот при сбое; мы отказались от самого требования, а не
            //    выбрали такой обходной путь.
            //
            // Если гарантия когда-нибудь понадобится (или шагов после регистрации станет
            // много), правильный путь — transactional outbox: запись «пользователь
            // зарегистрирован» сохраняется в той же транзакции, что и сам пользователь, а
            // потребитель идемпотентно доводит дело до конца. Общую транзакцию для этого
            // использовать не стоит по причине из первого пункта.
            await _userRegistrationHandler.OnUserRegisteredAsync(user.Id, cancellationToken);
        }

        return await IssueTokensAsync(user, cancellationToken);
    }

    /// <summary>
    ///     Обновляет сессию по refresh token: отзывает старый и выдаёт новую пару токенов (ротация).
    /// </summary>
    /// <exception cref="InvalidRefreshTokenException">Refresh token отсутствует, просрочен или уже отозван.</exception>
    public async Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var existing = await _refreshTokenRepository.GetByTokenHashAsync(Hash(refreshToken), cancellationToken);
        if (existing is null || !existing.IsActive)
        {
            throw new InvalidRefreshTokenException();
        }

        var user = await _userRepository.GetByIdAsync(existing.UserId, cancellationToken)
                   ?? throw new InvalidRefreshTokenException();

        existing.Revoke();
        await _refreshTokenRepository.SaveChangesAsync(cancellationToken);

        return await IssueTokensAsync(user, cancellationToken);
    }

    /// <summary>
    ///     Завершает сессию: отзывает refresh token. Если токен не найден, ничего не делает.
    /// </summary>
    public async Task LogoutAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var existing = await _refreshTokenRepository.GetByTokenHashAsync(Hash(refreshToken), cancellationToken);
        if (existing is null)
        {
            return;
        }

        existing.Revoke();
        await _refreshTokenRepository.SaveChangesAsync(cancellationToken);
    }

    private async Task<AuthResult> IssueTokensAsync(User user, CancellationToken cancellationToken)
    {
        var accessToken = _jwtTokenGenerator.GenerateAccessToken(user);

        var rawRefreshToken = GenerateRawToken();
        var refreshTokenExpiresAt = DateTimeOffset.UtcNow.Add(RefreshTokenLifetime);
        var refreshToken = RefreshToken.Issue(user.Id, Hash(rawRefreshToken), refreshTokenExpiresAt);
        await _refreshTokenRepository.AddAsync(refreshToken, cancellationToken);
        await _refreshTokenRepository.SaveChangesAsync(cancellationToken);

        return new AuthResult(accessToken.Value, accessToken.ExpiresAt, rawRefreshToken, refreshTokenExpiresAt, user.Name);
    }

    private static string GenerateRawToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));
}
