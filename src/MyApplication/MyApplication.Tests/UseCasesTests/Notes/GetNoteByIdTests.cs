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
        var created = await Sut.CreateAsync("Заголовок", "Текст заметки", CancellationToken.None);

        // Act
        var note = await Sut.GetByIdAsync(created.Id, CancellationToken.None);

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
            () => Sut.GetByIdAsync(Guid.NewGuid(), CancellationToken.None));
    }
}
