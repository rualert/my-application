using MyApplication.Application.Notes;
using MyApplication.Tests.UseCasesTests.Notes.Harness;

namespace MyApplication.Tests.UseCasesTests.Notes;

/// <summary>
///     Тесты сценария «получить заметку по идентификатору»
///     (<see cref="INoteService.GetByIdAsync"/>) как чёрный ящик.
/// </summary>
public class GetNoteByIdTests : NoteServiceTestBase
{
    [Fact]
    public async Task GetByIdAsync_ForExistingNote_ReturnsFullNote()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст заметки", CancellationToken.None);

        // Act
        var note = await Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None);

        // Assert
        Assert.Equal(created.Id, note.Id);
        Assert.Equal(created.Title, note.Title);
        Assert.Equal(created.Text, note.Text);
        Assert.Equal(created.CreatedAt, note.CreatedAt);
        Assert.Equal(created.UpdatedAt, note.UpdatedAt);
    }

    [Fact]
    public async Task GetByIdAsync_ForMissingNote_ThrowsNoteNotFoundException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.GetByIdAsync(CallerUserId, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task GetByIdAsync_ForNoteOwnedByAnotherUser_ThrowsNoteAccessDeniedException()
    {
        // Arrange
        var created = await Sut.CreateAsync(OtherUserId, "Заголовок", "Текст заметки", CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteAccessDeniedException>(
            () => Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None));
    }
}
