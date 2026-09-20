using MyApplication.Application.Auth;
using MyApplication.Tests.UseCasesTests.Auth.Harness;

namespace MyApplication.Tests.UseCasesTests.Auth;

/// <summary>
///     Тесты приветственной заметки, которую получает новый пользователь при
///     первом входе (<see cref="IAuthService.LoginWithGoogleAsync"/>), как чёрный ящик.
///     Заметки читаются через настоящий сервис заметок (см. <see cref="AuthServiceTestBase.Notes"/>).
/// </summary>
public class WelcomeNoteTests : AuthServiceTestBase
{
    [Fact]
    public async Task LoginWithGoogleAsync_ForNewUser_CreatesWelcomeNote()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-welcome", "welcome@example.com", "Новый пользователь");

        // Act
        var result = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);

        // Assert
        var notes = await Notes.GetAllAsync(UserIdOf(result), 0, 50, CancellationToken.None);
        var summary = Assert.Single(notes);
        Assert.Equal("Добро пожаловать", summary.Title);

        var note = await Notes.GetByIdAsync(UserIdOf(result), summary.Id, CancellationToken.None);
        Assert.Contains("https://github.com/rualert/my-application", note.Text);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_ForNewUser_WelcomeNoteEndsWithHotkeysSection()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-hotkeys", "hotkeys@example.com", "Пользователь");

        // Act
        var result = await Sut.LoginWithGoogleAsync("any-id-token", CancellationToken.None);

        // Assert
        var summary = Assert.Single(await Notes.GetAllAsync(UserIdOf(result), 0, 50, CancellationToken.None));
        var note = await Notes.GetByIdAsync(UserIdOf(result), summary.Id, CancellationToken.None);
        var lastHeading = note.Text.Split('\n').Last(line => line.StartsWith("## "));
        Assert.Equal("## Горячие клавиши", lastHeading);
        Assert.Contains("Shift", note.Text[note.Text.IndexOf("## Горячие клавиши", StringComparison.Ordinal)..]);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_ForExistingUser_DoesNotCreateAnotherWelcomeNote()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-repeat-welcome", "repeat@example.com", "Повторный пользователь");
        var first = await Sut.LoginWithGoogleAsync("first-id-token", CancellationToken.None);

        // Act
        var second = await Sut.LoginWithGoogleAsync("second-id-token", CancellationToken.None);

        // Assert
        Assert.Equal(UserIdOf(first), UserIdOf(second));
        var notes = await Notes.GetAllAsync(UserIdOf(second), 0, 50, CancellationToken.None);
        Assert.Single(notes);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_AfterWelcomeNoteDeleted_DoesNotRecreateIt()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-deleted-welcome", "deleted@example.com", "Пользователь");
        var first = await Sut.LoginWithGoogleAsync("first-id-token", CancellationToken.None);
        var userId = UserIdOf(first);
        var welcome = Assert.Single(await Notes.GetAllAsync(userId, 0, 50, CancellationToken.None));
        await Notes.DeleteAsync(userId, welcome.Id, CancellationToken.None);

        // Act
        await Sut.LoginWithGoogleAsync("second-id-token", CancellationToken.None);

        // Assert
        var notes = await Notes.GetAllAsync(userId, 0, 50, CancellationToken.None);
        Assert.Empty(notes);
    }

    [Fact]
    public async Task LoginWithGoogleAsync_ForDifferentNewUsers_GivesEachTheirOwnWelcomeNote()
    {
        // Arrange
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-first", "first@example.com", "Первый");
        var first = await Sut.LoginWithGoogleAsync("first-id-token", CancellationToken.None);
        GoogleValidator.NextResult = new GoogleUserInfo("google-subject-second", "second@example.com", "Второй");

        // Act
        var second = await Sut.LoginWithGoogleAsync("second-id-token", CancellationToken.None);

        // Assert
        var firstNotes = await Notes.GetAllAsync(UserIdOf(first), 0, 50, CancellationToken.None);
        var secondNotes = await Notes.GetAllAsync(UserIdOf(second), 0, 50, CancellationToken.None);
        var firstWelcome = Assert.Single(firstNotes);
        var secondWelcome = Assert.Single(secondNotes);
        Assert.NotEqual(firstWelcome.Id, secondWelcome.Id);
    }
}
