using MyApplication.Application.Notes;
using MyApplication.Domain.Notes;
using MyApplication.Tests.UseCasesTests.Notes.Harness;

namespace MyApplication.Tests.UseCasesTests.Notes;

/// <summary>
///     Тесты сценария «создать заметку» (<see cref="INoteService.CreateAsync"/>)
///     как чёрный ящик — через публичный контракт сервиса, без обращения
///     к деталям реализации. Бизнес-правила — см. docs/docs/notes/business-rules.md.
/// </summary>
public class CreateNoteTests : NoteServiceTestBase
{
    [Fact]
    public async Task CreateAsync_WithValidTitleAndText_ReturnsCreatedNote()
    {
        // Arrange
        // Act
        var note = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст заметки", CancellationToken.None);

        // Assert
        Assert.NotEqual(Guid.Empty, note.Id);
        Assert.Equal("Заголовок", note.Title);
        Assert.Equal("Текст заметки", note.Text);
        Assert.Equal(note.CreatedAt, note.UpdatedAt);
    }

    [Fact]
    public async Task CreateAsync_ReturnsNoteAtInitialVersion()
    {
        // Arrange
        // Act
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст заметки", CancellationToken.None);

        // Assert
        Assert.Equal(Note.InitialVersion, created.Version);
        var loaded = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);
        Assert.Equal(Note.InitialVersion, loaded.Version);
    }

    [Fact]
    public async Task CreateAsync_WithEmptyText_Succeeds()
    {
        // Arrange
        // Act
        var note = await Sut.CreateAsync(CallerUserId, "Заголовок", string.Empty, CancellationToken.None);

        // Assert
        Assert.Equal(string.Empty, note.Text);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAsync_WithMissingEmptyOrWhitespaceTitle_StoresNullTitle(string? title)
    {
        // Arrange
        // Act
        var created = await Sut.CreateAsync(CallerUserId, title, "Текст", CancellationToken.None);

        // Assert
        Assert.Null(created.Title);
        var loaded = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);
        Assert.Null(loaded.Title);
    }

    [Fact]
    public async Task CreateAsync_WithTitleAtMaxLength_Succeeds()
    {
        // Arrange
        var title = new string('a', 1024);

        // Act
        var note = await Sut.CreateAsync(CallerUserId, title, "Текст", CancellationToken.None);

        // Assert
        Assert.Equal(title, note.Title);
    }

    [Fact]
    public async Task CreateAsync_WithTitleLongerThanMaxLength_ThrowsNoteValidationException()
    {
        // Arrange
        var title = new string('a', 1025);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteValidationException>(
            () => Sut.CreateAsync(CallerUserId, title, "Текст", CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WithTextAtMaxSize_Succeeds()
    {
        // Arrange
        var text = new string('a', 1024 * 1024);

        // Act
        var note = await Sut.CreateAsync(CallerUserId, "Заголовок", text, CancellationToken.None);

        // Assert
        Assert.Equal(text.Length, note.Text.Length);
    }

    [Fact]
    public async Task CreateAsync_WithTextLargerThanMaxSize_ThrowsNoteValidationException()
    {
        // Arrange
        var text = new string('a', 1024 * 1024 + 1);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteValidationException>(
            () => Sut.CreateAsync(CallerUserId, "Заголовок", text, CancellationToken.None));
    }

    [Fact]
    public async Task CreateAsync_WithNullText_ThrowsArgumentNullException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>(
            () => Sut.CreateAsync(CallerUserId, "Заголовок", null!, CancellationToken.None));
    }
}
