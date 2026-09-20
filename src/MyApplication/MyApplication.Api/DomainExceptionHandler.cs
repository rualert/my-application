using Microsoft.AspNetCore.Diagnostics;
using MyApplication.Application.Auth;
using MyApplication.Application.Notes;
using MyApplication.Domain;

namespace MyApplication.Api;

/// <summary>
///     Глобально маппит любое <see cref="DomainException"/> (включая исключения
///     слоя Application, которые от него наследуются) на код ответа: 401 для
///     ошибок аутентификации (невалидный/просроченный токен), 403 для доступа
///     к чужому ресурсу, 409 для конфликта версий при одновременном
///     редактировании, 400 для остальных нарушений бизнес-правил.
///     Необработанные здесь исключения остаются 500 — их дальше обрабатывает
///     стандартный конвейер ASP.NET Core.
/// </summary>
public class DomainExceptionHandler : IExceptionHandler
{
    /// <summary>
    ///     Пытается обработать исключение как <see cref="DomainException"/>.
    /// </summary>
    /// <returns><c>true</c>, если исключение обработано (это было <see cref="DomainException"/>); иначе <c>false</c>.</returns>
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not DomainException domainException)
        {
            return false;
        }

        httpContext.Response.StatusCode = domainException switch
        {
            InvalidGoogleTokenException or InvalidRefreshTokenException => StatusCodes.Status401Unauthorized,
            NoteAccessDeniedException => StatusCodes.Status403Forbidden,
            NoteConflictException => StatusCodes.Status409Conflict,
            _ => StatusCodes.Status400BadRequest,
        };
        await httpContext.Response.WriteAsync(domainException.Message, cancellationToken);
        return true;
    }
}
