using MyApplication.Application.Auth;
using MyApplication.Tests.UseCasesTests.Auth.Harness;

namespace MyApplication.Tests.UseCasesTests.Auth;

/// <summary>
///     Тесты сценария «выйти» (<see cref="IAuthService.LogoutAsync"/>) как чёрный ящик.
/// </summary>
public class LogoutTests : AuthServiceTestBase
{
    [Fact]
    public async Task LogoutAsync_ForActiveRefreshToken_RevokesIt()
    {
        // Arrange
        var login = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);

        // Act
        await Sut.LogoutAsync(login.RefreshToken, CancellationToken.None);

        // Assert
        await Assert.ThrowsAsync<InvalidRefreshTokenException>(
            () => Sut.RefreshAsync(login.RefreshToken, CancellationToken.None));
    }

    [Fact]
    public async Task LogoutAsync_ForUnknownRefreshToken_DoesNotThrow()
    {
        // Arrange
        // Act
        var exception = await Record.ExceptionAsync(
            () => Sut.LogoutAsync("unknown-refresh-token", CancellationToken.None));

        // Assert
        Assert.Null(exception);
    }
}
