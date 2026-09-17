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
        var created = await Sut.CreateAsync("Заголовок", "Текст", CancellationToken.None);

        // Act
        await Sut.DeleteAsync(created.Id, CancellationToken.None);

        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.GetByIdAsync(created.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAsync_ForExistingNote_RemovesItFromList()
    {
        // Arrange
        var created = await Sut.CreateAsync("Заголовок", "Текст", CancellationToken.None);

        // Act
        await Sut.DeleteAsync(created.Id, CancellationToken.None);

        // Assert
        var notes = await Sut.GetAllAsync(0, 50, CancellationToken.None);
        Assert.DoesNotContain(notes, note => note.Id == created.Id);
    }

    [Fact]
    public async Task DeleteAsync_ForMissingNote_ThrowsNoteNotFoundException()
    {
        // Arrange
        // Act
        // Assert
        await Assert.ThrowsAsync<NoteNotFoundException>(
            () => Sut.DeleteAsync(Guid.NewGuid(), CancellationToken.None));
    }
}
