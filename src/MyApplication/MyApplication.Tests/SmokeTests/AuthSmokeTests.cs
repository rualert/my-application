using System.Net;
using System.Net.Http.Json;
using MyApplication.Api.Models.Auth;
using MyApplication.Tests.SmokeTests.Harness;

namespace MyApplication.Tests.SmokeTests;

/// <summary>
///     Смок-тесты фичи «Auth»: только blue sky сценарии, по одному на
///     операцию, через реальный HTTP — весь сервис целиком как чёрный ящик.
///     Google участвует через фейковый валидатор (см. <see cref="SmokeTestFixture"/>) —
///     реальные серверы Google в тестах недостижимы.
/// </summary>
public class AuthSmokeTests : SmokeTestBase
{
    public AuthSmokeTests(SmokeTestFixture fixture) : base(fixture)
    {
    }

    [Fact]
    public async Task Google_BlueSky()
    {
        // Arrange
        // Act
        var response = await Sut.PostAsJsonAsync("/Auth/google", new GoogleLoginRequest("test-user"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth!.AccessToken));
        Assert.True(response.Headers.TryGetValues("Set-Cookie", out _));
    }

    [Fact]
    public async Task Refresh_BlueSky()
    {
        // Arrange
        await Sut.PostAsJsonAsync("/Auth/google", new GoogleLoginRequest("test-user"));

        // Act
        var response = await Sut.PostAsync("/Auth/refresh", null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>();
        Assert.NotNull(auth);
        Assert.False(string.IsNullOrWhiteSpace(auth!.AccessToken));
    }

    [Fact]
    public async Task Logout_BlueSky()
    {
        // Arrange
        await Sut.PostAsJsonAsync("/Auth/google", new GoogleLoginRequest("test-user"));

        // Act
        var response = await Sut.PostAsync("/Auth/logout", null);

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var refreshResponse = await Sut.PostAsync("/Auth/refresh", null);
        Assert.Equal(HttpStatusCode.Unauthorized, refreshResponse.StatusCode);
    }
}
