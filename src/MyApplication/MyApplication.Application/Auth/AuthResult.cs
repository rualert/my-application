namespace MyApplication.Application.Auth;

/// <summary>
///     Результат входа/обновления сессии: новый access token и сырое
///     значение нового refresh token (контроллер кладёт его в httpOnly cookie).
/// </summary>
public record AuthResult(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, DateTimeOffset RefreshTokenExpiresAt);
