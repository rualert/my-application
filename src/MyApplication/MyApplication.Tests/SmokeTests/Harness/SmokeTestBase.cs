using System.Net.Http.Headers;
using System.Net.Http.Json;
using MyApplication.Api.Models.Auth;

namespace MyApplication.Tests.SmokeTests.Harness;

/// <summary>
///     Базовый класс для смок-тестов. Даёт доступ к общему HTTP-клиенту
///     приложения (<see cref="SmokeTestFixture"/> на всю сессию) и очищает
///     данные в базе перед каждым тестом, чтобы сценарии не влияли друг на друга.
/// </summary>
[Collection(SmokeTestCollection.Name)]
public abstract class SmokeTestBase : IAsyncLifetime
{
    private readonly SmokeTestFixture _fixture;

    protected SmokeTestBase(SmokeTestFixture fixture)
    {
        _fixture = fixture;
    }

    /// <summary>
    ///     HTTP-клиент приложения — единственная точка входа для тестов (SUT,
    ///     весь сервис как чёрный ящик, без обращения к деталям реализации).
    /// </summary>
    protected HttpClient Sut => _fixture.Sut;

    /// <summary>
    ///     Очищает данные в базе перед очередным тестом.
    /// </summary>
    public Task InitializeAsync()
    {
        return _fixture.ResetAsync();
    }

    /// <summary>
    ///     Ничего не делает — ресурсы сессии освобождает <see cref="SmokeTestFixture"/>.
    /// </summary>
    public Task DisposeAsync()
    {
        return Task.CompletedTask;
    }

    /// <summary>
    ///     Логинится через (фейковый в тестах — см. <see cref="SmokeTestFixture"/>)
    ///     Google и возвращает выданный access token. Фейковый валидатор выводит
    ///     Google-профиль прямо из <paramref name="idToken"/> — разные значения
    ///     дают разных пользователей приложения.
    /// </summary>
    protected async Task<string> LoginAsync(string idToken = "test-user")
    {
        var response = await Sut.PostAsJsonAsync("/Auth/google", new GoogleLoginRequest(idToken));
        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return auth!.AccessToken;
    }

    /// <summary>
    ///     Строит HTTP-запрос с приложенным access token'ом в заголовке Authorization.
    /// </summary>
    protected static HttpRequestMessage AuthorizedRequest(HttpMethod method, string url, string accessToken, HttpContent? content = null)
    {
        var request = new HttpRequestMessage(method, url) { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        return request;
    }
}
