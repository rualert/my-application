namespace MyApplication.Api.Models.Auth;

/// <summary>
///     Access token, момент истечения его срока действия и имя пользователя
///     (для отображения в интерфейсе). Refresh token в тело ответа не попадает —
///     он ставится httpOnly-cookie'й (см. <see cref="MyApplication.Api.Controllers.AuthController"/>).
/// </summary>
public record AuthResponse(string AccessToken, DateTimeOffset ExpiresAt, string UserName);
