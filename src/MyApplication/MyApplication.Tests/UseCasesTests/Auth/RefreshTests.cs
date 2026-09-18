using MyApplication.Application.Auth;
using MyApplication.Tests.UseCasesTests.Auth.Harness;

namespace MyApplication.Tests.UseCasesTests.Auth;

/// <summary>
///     Тесты сценария «обновить сессию» (<see cref="IAuthService.RefreshAsync"/>)
///     как чёрный ящик.
/// </summary>
public class RefreshTests : AuthServiceTestBase
{
    [Fact]
    public async Task RefreshAsync_WithValidRefreshToken_ReturnsNewTokens()
    {
        // Arrange
        var login = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);

        // Act
        var refreshed = await Sut.RefreshAsync(login.RefreshToken, CancellationToken.None);

        // Assert
        Assert.False(string.IsNullOrWhiteSpace(refreshed.AccessToken));
        Assert.NotEqual(login.RefreshToken, refreshed.RefreshToken);
    }

    [Fact]
    public async Task RefreshAsync_WithAlreadyRotatedRefreshToken_ThrowsInvalidRefreshTokenException()
    {
        // Arrange
        var login = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);
        await Sut.RefreshAsync(login.RefreshToken, CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<InvalidRefreshTokenException>(
            () => Sut.RefreshAsync(login.RefreshToken, CancellationToken.None));
    }

    [Fact]
    public async Task RefreshAsync_WithUnknownRefreshToken_ThrowsInvalidRefreshTokenException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<InvalidRefreshTokenException>(
            () => Sut.RefreshAsync("unknown-refresh-token", CancellationToken.None));
    }
}
