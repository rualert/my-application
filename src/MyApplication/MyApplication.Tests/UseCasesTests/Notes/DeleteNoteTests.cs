using MyApplication.Application.Notes;
using MyApplication.Tests.UseCasesTests.Notes.Harness;

namespace MyApplication.Tests.UseCasesTests.Notes;

/// <summary>
///     Тесты сценария «удалить заметку» (<see cref="INoteService.DeleteAsync"/>)
///     как чёрный ящик.
/// </summary>
public class DeleteNoteTests : NoteServiceTestBase
{
    [Fact]
    public async Task DeleteAsync_ForExistingNote_RemovesIt()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        await Sut.DeleteAsync(CallerUserId, created.Id, CancellationToken.None);

        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.GetByIdAsync(CallerUserId, created.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_ForExistingNote_RemovesItFromList()
    {
        // Arrange
        var created = await Sut.CreateAsync(CallerUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        await Sut.DeleteAsync(CallerUserId, created.Id, CancellationToken.None);

        // Assert
        var notes = await Sut.GetAllAsync(CallerUserId, 0, 50, CancellationToken.None);
        Assert.DoesNotContain(notes, note => note.Id == created.Id);
    }

    [Fact]
    public async Task DeleteAsync_ForMissingNote_ThrowsNoteNotFoundException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.DeleteAsync(CallerUserId, Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_ForNoteOwnedByAnotherUser_ThrowsNoteAccessDeniedException()
    {
        // Arrange
        var created = await Sut.CreateAsync(OtherUserId, "Заголовок", "Текст", CancellationToken.None);

        // Act
        // Assert
        await Assert.ThrowsAsync<NoteAccessDeniedException>(
            () => Sut.DeleteAsync(CallerUserId, created.Id, CancellationToken.None));
    }
}
