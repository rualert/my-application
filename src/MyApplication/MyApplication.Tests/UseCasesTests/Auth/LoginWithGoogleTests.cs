using MyApplication.Application.Auth;
using MyApplication.Tests.UseCasesTests.Auth.Harness;

namespace MyApplication.Tests.UseCasesTests.Auth;

/// <summary>
///     Тесты сценария «войти через Google» (<see cref="IAuthService.LoginWithGoogleAsync"/>)
///     как чёрный ящик.
/// </summary>
public class LoginWithGoogleTests : AuthServiceTestBase
{
    [Fact]
    public async Task LoginWithGoogleAsync_ForNewGoogleUser_CreatesUserAndReturnsTokens()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-new", "new@example.com", "Новый пользователь");

        // Act
        var result = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);

        // Assert
        Assert.False(string.IsNullOrWhiteSpace(result.AccessToken));
        Assert.False(string.IsNullOrWhiteSpace(result.RefreshToken));
        Assert.True(result.AccessTokenExpiresAt > DateTimeOffset.UtcNow);
        Assert.True(result.RefreshTokenExpiresAt > result.AccessTokenExpiresAt);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_ForSameGoogleUserTwice_ReusesSameUser()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-repeat", "repeat@example.com", "Повторный пользователь");

        // Act
        var first = await Sut.LoginWithGoogleAsync("first-id-token", CancellationToken.None);
        var second = await Sut.LoginWithGoogleAsync("second-id-token", CancellationToken.None);

        // Assert
        Assert.NotEqual(first.RefreshToken, second.RefreshToken);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_WithInvalidGoogleToken_ThrowsInvalidGoogleTokenException()
    {
        // Arrange
        GoogleValidator.FailNextValidation = true;

        // Act
        // Assert
        await Assert.ThrowsAsync<InvalidGoogleTokenException>(
            () => Sut.LoginWithGoogleAsync("invalid-id-token", CancellationToken.None));
    }
}
