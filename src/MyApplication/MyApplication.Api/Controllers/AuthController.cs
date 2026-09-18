using Microsoft.AspNetCore.Mvc;
using MyApplication.Api.Models.Auth;
using MyApplication.Application.Auth;

namespace MyApplication.Api.Controllers;

/// <summary>
///     Вход через Google и управление сессией (JWT access + refresh). Refresh
///     token живёт в httpOnly-cookie, скоупленной на этот контроллер — на
///     клиенте в JS он недоступен. Исключения слоя Domain/Application (см.
///     <see cref="MyApplication.Domain.DomainException"/>) в 401/403/400
///     маппит глобальный обработчик — контроллеру ловить их не нужно.
/// </summary>
[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private const string RefreshTokenCookieName = "refresh_token";

    private readonly IAuthService _authService;
    private readonly IWebHostEnvironment _environment;

    /// <summary>
    ///     Создаёт экземпляр контроллера с внедрённым сервисом аутентификации.
    /// </summary>
    public AuthController(IAuthService authService, IWebHostEnvironment environment)
    {
        _authService = authService;
        _environment = environment;
    }

    /// <summary>
    ///     Входит по Google ID token: находит существующего пользователя либо создаёт нового.
    /// </summary>
    /// <returns>Access token с кодом 200, либо 401 при невалидном токене Google.</returns>
    [HttpPost("google")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Google(GoogleLoginRequest request, CancellationToken cancellationToken)
    {
        var result = await _authService.LoginWithGoogleAsync(request.IdToken, cancellationToken);
        SetRefreshTokenCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        return Ok(new AuthResponse(result.AccessToken, result.AccessTokenExpiresAt, result.UserName));
    }

    /// <summary>
    ///     Обновляет сессию по refresh token из cookie (ротация: старый отзывается, выдаётся новый).
    /// </summary>
    /// <returns>Новый access token с кодом 200, либо 401, если refresh token отсутствует/просрочен/отозван.</returns>
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Refresh(CancellationToken cancellationToken)
    {
        if (!Request.Cookies.TryGetValue(RefreshTokenCookieName, out var refreshToken))
        {
            throw new InvalidRefreshTokenException();
        }

        var result = await _authService.RefreshAsync(refreshToken, cancellationToken);
        SetRefreshTokenCookie(result.RefreshToken, result.RefreshTokenExpiresAt);
        return Ok(new AuthResponse(result.AccessToken, result.AccessTokenExpiresAt, result.UserName));
    }

    /// <summary>
    ///     Завершает сессию: отзывает refresh token из cookie и удаляет саму cookie.
    /// </summary>
    /// <returns>204 в любом случае — logout идемпотентен.</returns>
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        if (Request.Cookies.TryGetValue(RefreshTokenCookieName, out var refreshToken))
        {
            await _authService.LogoutAsync(refreshToken, cancellationToken);
        }

        Response.Cookies.Delete(RefreshTokenCookieName, new CookieOptions { Path = "/Auth" });
        return NoContent();
    }

    private void SetRefreshTokenCookie(string refreshToken, DateTimeOffset expiresAt)
    {
        Response.Cookies.Append(RefreshTokenCookieName, refreshToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Path = "/Auth",
            Expires = expiresAt,
        });
    }
}
