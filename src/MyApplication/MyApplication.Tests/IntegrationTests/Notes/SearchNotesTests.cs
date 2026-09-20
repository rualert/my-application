using MyApplication.Application.Notes;
using MyApplication.Tests.IntegrationTests.Harness;
using MyApplication.Tests.IntegrationTests.Notes.Harness;

namespace MyApplication.Tests.IntegrationTests.Notes;

/// <summary>
///     Тесты сценария «найти заметки» (<see cref="INoteService.SearchAsync"/>)
///     как чёрный ящик, против настоящего PostgreSQL: отбор, порядок выдачи и
///     поиск с опечатками считает сама СУБД, поэтому проверить их можно только так.
/// </summary>
public class SearchNotesTests : NoteServiceIntegrationTestBase
{
    private const string Keyword = "инвентаризация";
    private const string KeywordWithTypo = "инвентеризация";

    public SearchNotesTests(PostgresFixture fixture) : base(fixture)
    {
    }

    [Fact]
    public async Task SearchAsync_FindsNoteByWordFromTitle()
    {
        // Arrange
        var note = await Sut.CreateAsync(CallerUserId, $"{Keyword} склада", "Ничего особенного", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([note.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_FindsNoteByWordFromText()
    {
        // Arrange
        var note = await Sut.CreateAsync(CallerUserId, "Склад", $"Нужна {Keyword} до конца месяца", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([note.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_FindsNoteWhenQueryHasTypo()
    {
        // Arrange
        var note = await Sut.CreateAsync(CallerUserId, $"{Keyword} склада", "Ничего особенного", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, KeywordWithTypo, CancellationToken.None);

        // Assert
        Assert.Equal([note.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_WithoutMatches_ReturnsEmptyList()
    {
        // Arrange
        await Sut.CreateAsync(CallerUserId, "Список покупок", "Молоко и хлеб", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, "абракадабра", CancellationToken.None);

        // Assert
        Assert.Empty(results);
    }

    [Fact]
    public async Task SearchAsync_DoesNotReturnNotesOwnedByAnotherUser()
    {
        // Arrange
        var own = await Sut.CreateAsync(CallerUserId, $"Моя {Keyword}", "Текст", CancellationToken.None);
        await Sut.CreateAsync(OtherUserId, $"Чужая {Keyword}", "Текст", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([own.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_RanksExactTitleMatchAboveExactTextMatch()
    {
        // Arrange
        var titleMatch = await Sut.CreateAsync(CallerUserId, $"{Keyword} склада", "Ничего особенного", CancellationToken.None);
        var textMatch = await Sut.CreateAsync(CallerUserId, "Склад", $"Нужна {Keyword} до конца месяца", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([titleMatch.Id, textMatch.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_RanksExactTextMatchAboveSimilarTitleMatch()
    {
        // Arrange
        var textMatch = await Sut.CreateAsync(CallerUserId, "Склад", $"Нужна {Keyword} до конца месяца", CancellationToken.None);
        var similarTitleMatch = await Sut.CreateAsync(CallerUserId, KeywordWithTypo, "Ничего особенного", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([textMatch.Id, similarTitleMatch.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_RanksMatchInBothFieldsAboveMatchInTitleOnly()
    {
        // Arrange
        var bothFieldsMatch = await Sut.CreateAsync(CallerUserId, Keyword, $"{Keyword} склада завтра", CancellationToken.None);
        var titleOnlyMatch = await Sut.CreateAsync(CallerUserId, $"{Keyword} склада", "Ничего особенного", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal([bothFieldsMatch.Id, titleOnlyMatch.Id], results.Select(result => result.Id));
    }

    [Fact]
    public async Task SearchAsync_WithMoreMatchesThanLimit_ReturnsOnlyTenNotes()
    {
        // Arrange
        for (var index = 0; index < NoteService.MaxSearchResults + 2; index++)
        {
            await Sut.CreateAsync(CallerUserId, $"{Keyword} №{index}", "Текст", CancellationToken.None);
        }

        // Act
        var results = await Sut.SearchAsync(CallerUserId, Keyword, CancellationToken.None);

        // Assert
        Assert.Equal(NoteService.MaxSearchResults, results.Count);
    }

    [Theory]
    [InlineData("")]
    [InlineData("и")]
    [InlineData("ин")]
    [InlineData("  ин  ")]
    public async Task SearchAsync_WithTooShortQuery_ThrowsApplicationException(string query)
    {
        // Arrange
        // Act
        var exception = await Record.ExceptionAsync(() => Sut.SearchAsync(CallerUserId, query, CancellationToken.None));

        // Assert
        Assert.IsType<MyApplication.Application.ApplicationException>(exception);
    }

    [Fact]
    public async Task SearchAsync_MarksMatchInTitleAndInSnippet()
    {
        // Arrange
        await Sut.CreateAsync(CallerUserId, "Мои покупки", "Надо сделать покупки завтра", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, "покуп", CancellationToken.None);

        // Assert
        var found = Assert.Single(results);
        Assert.Equal(
            [new HighlightedSegment("Мои ", false), new HighlightedSegment("покуп", true), new HighlightedSegment("ки", false)],
            found.Title);
        Assert.Equal(
            [new HighlightedSegment("Надо сделать ", false), new HighlightedSegment("покуп", true), new HighlightedSegment("ки завтра", false)],
            found.Snippet);
    }

    [Fact]
    public async Task SearchAsync_MarksMatchFoundWithTypo()
    {
        // Arrange
        await Sut.CreateAsync(CallerUserId, $"План: {Keyword} склада", "Ничего особенного", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, KeywordWithTypo, CancellationToken.None);

        // Assert
        var found = Assert.Single(results);
        Assert.Equal([Keyword], found.Title.Where(segment => segment.Match).Select(segment => segment.Text));
    }

    [Fact]
    public async Task SearchAsync_ForNoteWithoutTitle_ReturnsNoTitleSegments()
    {
        // Arrange
        await Sut.CreateAsync(CallerUserId, null, "Надо сделать покупки завтра", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, "покуп", CancellationToken.None);

        // Assert
        var found = Assert.Single(results);
        Assert.Empty(found.Title);
    }

    [Fact]
    public async Task SearchAsync_ForLongText_ReturnsOnlyFragmentAroundMatch()
    {
        // Arrange
        var filler = string.Join(" ", Enumerable.Repeat("слово", 100));
        await Sut.CreateAsync(CallerUserId, "Заголовок", $"{filler} покупки {filler}", CancellationToken.None);

        // Act
        var results = await Sut.SearchAsync(CallerUserId, "покуп", CancellationToken.None);

        // Assert
        var found = Assert.Single(results);
        var snippet = string.Concat(found.Snippet.Select(segment => segment.Text));
        Assert.Equal(["покуп"], found.Snippet.Where(segment => segment.Match).Select(segment => segment.Text));
        Assert.StartsWith("…", snippet);
        Assert.EndsWith("…", snippet);
        Assert.True(
            snippet.Length <= SearchSnippetBuilder.SnippetLength + 2,
            $"Фрагмент длиной {snippet.Length} символов — ожидался не длиннее {SearchSnippetBuilder.SnippetLength} плюс два многоточия.");
    }
}
