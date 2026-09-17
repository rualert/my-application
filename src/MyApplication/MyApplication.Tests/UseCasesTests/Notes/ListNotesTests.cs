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
        var notes = await Sut.GetAllAsync(0, 50, CancellationToken.None);

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
        var notes = await Sut.GetAllAsync(0, 50, CancellationToken.None);

        // Assert
        Assert.Equal(2, notes.Count);
        Assert.Contains(notes, note => note.Id == first.Id && note.Title == first.Title);
        Assert.Contains(notes, note => note.Id == second.Id && note.Title == second.Title);
    }

    [Fact]
    public async Task GetAllAsync_ReturnsNotesOrderedFromNewestToOldest()
    {
        // Arrange
        var first = await Sut.CreateAsync("Первая", "Текст 1", CancellationToken.None);
        var second = await Sut.CreateAsync("Вторая", "Текст 2", CancellationToken.None);
        var third = await Sut.CreateAsync("Третья", "Текст 3", CancellationToken.None);

        // Act
        var notes = await Sut.GetAllAsync(0, 50, CancellationToken.None);

        // Assert
        Assert.Equal([third.Id, second.Id, first.Id], notes.Select(note => note.Id));
    }

    [Fact]
    public async Task GetAllAsync_WithCountLessThanTotal_ReturnsOnlyRequestedCount()
    {
        // Arrange
        await Sut.CreateAsync("Первая", "Текст 1", CancellationToken.None);
        var second = await Sut.CreateAsync("Вторая", "Текст 2", CancellationToken.None);
        await Sut.CreateAsync("Третья", "Текст 3", CancellationToken.None);

        // Act
        var notes = await Sut.GetAllAsync(1, 1, CancellationToken.None);

        // Assert
        Assert.Equal([second.Id], notes.Select(note => note.Id));
    }

    [Fact]
    public async Task GetAllAsync_WithFromBeyondTotal_ReturnsEmptyList()
    {
        // Arrange
        await Sut.CreateAsync("Первая", "Текст 1", CancellationToken.None);

        // Act
        var notes = await Sut.GetAllAsync(5, 50, CancellationToken.None);

        // Assert
        Assert.Empty(notes);
    }

    [Fact]
    public async Task GetAllAsync_WithNegativeFrom_ThrowsApplicationException()
    {
        // Arrange
        // Act
        var exception = await Record.ExceptionAsync(() => Sut.GetAllAsync(-1, 50, CancellationToken.None));

        // Assert
        Assert.IsType<MyApplication.Application.ApplicationException>(exception);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task GetAllAsync_WithNonPositiveCount_ThrowsApplicationException(int count)
    {
        // Arrange
        // Act
        var exception = await Record.ExceptionAsync(() => Sut.GetAllAsync(0, count, CancellationToken.None));

        // Assert
        Assert.IsType<MyApplication.Application.ApplicationException>(exception);
    }
}
