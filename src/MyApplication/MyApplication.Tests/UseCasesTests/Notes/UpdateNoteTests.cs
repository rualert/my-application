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
        var created = await Sut.CreateAsync("Старый заголовок", "Старый текст", CancellationToken.None);

        // Act
        var updated = await Sut.UpdateAsync(created.Id, "Новый заголовок", "Новый текст", CancellationToken.None);

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
        var created = await Sut.CreateAsync("Старый заголовок", "Старый текст", CancellationToken.None);
        await Sut.UpdateAsync(created.Id, "Новый заголовок", "Новый текст", CancellationToken.None);

        // Act
        var note = await Sut.GetByIdAsync(created.Id, CancellationToken.None);

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
            () => Sut.UpdateAsync(Guid.NewGuid(), "Заголовок", "Текст", CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_WithEmptyTitle_ThrowsNoteValidationException()
    {
        // Arrange
        var created = await Sut.CreateAsync("Заголовок", "Текст", CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteValidationException>(
            () => Sut.UpdateAsync(created.Id, string.Empty, "Текст", CancellationToken.None));
    }

    [Fact]
    public async Task UpdateAsync_WithTitleLongerThanMaxLength_ThrowsNoteValidationException()
    {
        // Arrange
        var created = await Sut.CreateAsync("Заголовок", "Текст", CancellationToken.None);
        var tooLongTitle = new string('a', 1025);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteValidationException>(
            () => Sut.UpdateAsync(created.Id, tooLongTitle, "Текст", CancellationToken.None));
    }
}
