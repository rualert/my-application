namespace MyApplication.Application.Auth;

/// <summary>
///     Use case'ы для входа через Google и управления сессией (JWT access + refresh).
/// </summary>
public interface IAuthService
{
    /// <summary>
    ///     Входит по Google ID token: находит существующего пользователя по
    ///     профилю Google либо создаёт нового, выдаёт новую пару токенов.
    /// </summary>
    /// <exception cref="InvalidGoogleTokenException">Токен Google невалиден.</exception>
    Task<AuthResult> LoginWithGoogleAsync(string googleIdToken, CancellationToken cancellationToken);

    /// <summary>
    ///     Обновляет сессию по refresh token: отзывает старый и выдаёт новую пару токенов (ротация).
    /// </summary>
    /// <exception cref="InvalidRefreshTokenException">Refresh token отсутствует, просрочен или уже отозван.</exception>
    Task<AuthResult> RefreshAsync(string refreshToken, CancellationToken cancellationToken);

    /// <summary>
    ///     Завершает сессию: отзывает refresh token. Если токен не найден, ничего не делает.
    /// </summary>
    Task LogoutAsync(string refreshToken, CancellationToken cancellationToken);
}
