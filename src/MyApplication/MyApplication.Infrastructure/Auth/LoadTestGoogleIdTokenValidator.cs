using MyApplication.Application.Auth;

namespace MyApplication.Infrastructure.Auth;

/// <summary>
///     Двойник <see cref="IGoogleIdTokenValidator"/> для изолированного
///     нагрузочного стенда (<c>ci/docker-compose.load-tests-db.yml</c>,
///     <c>ASPNETCORE_ENVIRONMENT=LoadTest</c>) — настоящие серверы Google
///     недоступны/не нужны для измерения RPS. Профиль выводится прямо из
///     переданного <c>idToken</c> (используется как Google subject), тем же
///     способом, что и <c>FakeGoogleIdTokenValidator</c> в смок-тестах —
///     k6-сценарии передают фиксированный idToken, поэтому все запросы одного
///     прогона идут от одного и того же пользователя.
/// </summary>
public class LoadTestGoogleIdTokenValidator : IGoogleIdTokenValidator
{
    public Task<GoogleUserInfo> ValidateAsync(string idToken, CancellationToken cancellationToken)
    {
        return Task.FromResult(new GoogleUserInfo(idToken, $"{idToken}@example.com", "Пользователь нагрузочного теста"));
    }
}
