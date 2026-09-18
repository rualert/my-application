namespace MyApplication.Application.Auth;

/// <summary>
///     Результат входа/обновления сессии: новый access token, сырое значение
///     нового refresh token (контроллер кладёт его в httpOnly cookie) и имя
///     пользователя (для отображения в интерфейсе).
/// </summary>
public record AuthResult(string AccessToken, DateTimeOffset AccessTokenExpiresAt, string RefreshToken, DateTimeOffset RefreshTokenExpiresAt, string UserName);
