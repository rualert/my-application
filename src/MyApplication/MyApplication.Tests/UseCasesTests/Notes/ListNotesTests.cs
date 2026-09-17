using MyApplication.Application.Notes;
using MyApplication.Tests.UseCasesTests.Notes.Harness;

namespace MyApplication.Tests.UseCasesTests.Notes;

/// <summary>
///     Тесты сценария «получить список заметок» (<see cref="INoteService.GetAllAsync"/>)
///     как чёрный ящик.
/// </summary>
public class ListNotesTests : NoteServiceTestBase
{
    [Fact]
    public async Task GetAllAsync_WithNoNotes_ReturnsEmptyList()
    {
        // Arrange
        // Act
        var notes = await Sut.GetAllAsync(CancellationToken.None);

        // Assert
        Assert.Empty(notes);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsSummaryForEveryCreatedNote()
    {
        // Arrange
        var first = await Sut.CreateAsync("Первая", "Текст 1", CancellationToken.None);
        var second = await Sut.CreateAsync("Вторая", "Текст 2", CancellationToken.None);

        // Act
        var notes = await Sut.GetAllAsync(CancellationToken.None);

        // Assert
        Assert.Equal(2, notes.Count);
        Assert.Contains(notes, note => note.Id == first.Id && note.Title == first.Title);
        Assert.Contains(notes, note => note.Id == second.Id && note.Title == second.Title);
    }
}
