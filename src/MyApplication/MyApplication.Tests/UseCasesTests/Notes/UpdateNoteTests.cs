using MyApplication.Application.Notes;
using MyApplication.Domain.Notes;
using MyApplication.Tests.UseCasesTests.Notes.Harness;

namespace MyApplication.Tests.UseCasesTests.Notes;

/// <summary>
///     Тесты сценария «обновить заметку» (<see cref="INoteService.UpdateAsync"/>)
///     как чёрный ящик.
/// </summary>
public class UpdateNoteTests : NoteServiceTestBase
{
    [Fact]
    public async Task UpdateAsync_ForExistingNote_ChangesTitleAndText()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Старый заголовок", "Старый текст", CancellationToken.None);

        // Act
        var updated = await Sut.UpdateAsync(CallerUserId, created.Id, "Новый заголовок", "Новый текст", created.Version, CancellationToken.None);

        // Assert
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal("Новый заголовок", updated.Title);
        Assert.Equal("Новый текст", updated.Text);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
        Assert.True(updated.UpdatedAt >= created.UpdatedAt);
    }

    [Fact]
    public async Task UpdateAsync_ForExistingNote_IsReflectedByLaterGet()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Старый заголовок", "Старый текст", CancellationToken.None);
        await Sut.UpdateAsync(CallerUserId, created.Id, "Новый заголовок", "Новый текст", created.Version, CancellationToken.None);

        // Act
        var note = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);

        // Assert
        Assert.Equal("Новый заголовок", note.Title);
        Assert.Equal("Новый текст", note.Text);
    }

    [Fact]
    public async Task UpdateAsync_ForMissingNote_ThrowsNoteNotFoundException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.UpdateAsync(CallerUserId, Guid.NewGuid(), "Заголовок", "Текст", 1, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_ForNoteOwnedByAnotherUser_ThrowsNoteAccessDeniedException()
    {
        // Arrange
        var created = await Sut.CreateAsync(OtherUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteAccessDeniedException>(
            () => Sut.UpdateAsync(CallerUserId, created.Id, "Новый заголовок", "Новый текст", created.Version, CancellationToken.None));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task UpdateAsync_WithMissingEmptyOrWhitespaceTitle_ClearsTitleToNull(string? title)
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        var updated = await Sut.UpdateAsync(CallerUserId, created.Id, title, "Текст", created.Version, CancellationToken.None);

        // Assert
        Assert.Null(updated.Title);
        var loaded = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);
        Assert.Null(loaded.Title);
    }

    [Fact]
    public async Task UpdateAsync_WithTitleLongerThanMaxLength_ThrowsNoteValidationException()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);
        var tooLongTitle = new string('a', 1025);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteValidationException>(
            () => Sut.UpdateAsync(CallerUserId, created.Id, tooLongTitle, "Текст", created.Version, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_ForExistingNote_IncrementsVersion()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        var updated = await Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Другой текст", created.Version, CancellationToken.None);

        // Assert
        Assert.Equal(created.Version + 1, updated.Version);
        var loaded = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);
        Assert.Equal(updated.Version, loaded.Version);
    }

    [Fact]
    public async Task UpdateAsync_WithVersionFromPreviousUpdate_ThrowsNoteConflictException()
    {
        // Arrange: заметку уже изменили в другом месте — версия, с которой
        // работает вызывающий, устарела.
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);
        await Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Правка из другой вкладки", created.Version, CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteConflictException>(
            () => Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Своя правка", created.Version, CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_WithStaleVersion_LeavesNoteUnchanged()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);
        var other = await Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Правка из другой вкладки", created.Version, CancellationToken.None);

        // Act
        await Assert.ThrowsAsync<NoteConflictException>(
            () => Sut.UpdateAsync(CallerUserId, created.Id, "Свой заголовок", "Своя правка", created.Version, CancellationToken.None));

        // Assert
        var loaded = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);
        Assert.Equal("Правка из другой вкладки", loaded.Text);
        Assert.Equal(other.Version, loaded.Version);
    }

    [Fact]
    public async Task UpdateAsync_WithVersionFromLatestUpdate_Succeeds()
    {
        // Arrange: после конфликта достаточно перечитать заметку — её версия снова подходит.
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);
        await Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Правка из другой вкладки", created.Version, CancellationToken.None);
        var latest = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);

        // Act
        var updated = await Sut.UpdateAsync(CallerUserId, created.Id, "Заголовок", "Своя правка", latest.Version, CancellationToken.None);

        // Assert
        Assert.Equal("Своя правка", updated.Text);
    }
}
