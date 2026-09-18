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

    /// <summary>
    ///     Создаёт сервис аутентификации поверх переданных портов.
    /// </summary>
    public AuthService(
        IUserRepository userRepository,
        IRefreshTokenRepository refreshTokenRepository,
        IGoogleIdTokenValidator googleIdTokenValidator,
        IJwtTokenGenerator jwtTokenGenerator)
    {
        _userRepository = userRepository;
        _refreshTokenRepository = refreshTokenRepository;
        _googleIdTokenValidator = googleIdTokenValidator;
        _jwtTokenGenerator = jwtTokenGenerator;
    }

    /// <summary>
    ///     Входит по Google ID token: находит существующего пользователя по
    ///     профилю Google либо создаёт нового, выдаёт новую пару токенов.
    /// </summary>
    /// <exception cref="InvalidGoogleTokenException">Токен Google невалиден.</exception>
    public async Task<AuthResult> LoginWithGoogleAsync(string googleIdToken, CancellationToken cancellationToken)
    {
        var googleUser = await _googleIdTokenValidator.ValidateAsync(googleIdToken, cancellationToken);

        var user = await _userRepository.GetByGoogleSubjectIdAsync(googleUser.Subject, cancellationToken);
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

        return new AuthResult(accessToken.Value, accessToken.ExpiresAt, rawRefreshToken, refreshTokenExpiresAt);
    }

    private static string GenerateRawToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));
}
