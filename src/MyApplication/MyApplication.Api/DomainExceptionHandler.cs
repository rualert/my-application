using Microsoft.AspNetCore.Diagnostics;
using MyApplication.Domain;

namespace MyApplication.Api;

/// <summary>
///     Глобально маппит любое <see cref="DomainException"/> (включая исключения
///     слоя Application, которые от него наследуются) на 400 Bad Request.
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

        httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
        await httpContext.Response.WriteAsync(domainException.Message, cancellationToken);
        return true;
    }
}
