using System.Net;
using System.Net.Http.Json;
using MyApplication.Api.Models;
using MyApplication.Tests.SmokeTests.Harness;

namespace MyApplication.Tests.SmokeTests;

/// <summary>
///     Смок-тесты фичи «Заметки»: только blue sky сценарии, по одному на
///     операцию, через реальный HTTP — весь сервис целиком как чёрный ящик,
///     без обращения к деталям реализации. Заметки приватны, поэтому каждый
///     запрос выполняется от имени залогиненного пользователя (см. <see cref="SmokeTestBase.LoginAsync"/>).
/// </summary>
public class NotesSmokeTests : SmokeTestBase
{
    public NotesSmokeTests(SmokeTestFixture fixture) : base(fixture)
    {
    }

    [Fact]
    public async Task Create_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.NotEqual(Guid.Empty, note!.Id);
        Assert.Equal("Заголовок", note.Title);
        Assert.Equal("Текст заметки", note.Text);
    }

    [Fact]
    public async Task Create_WithoutTitle_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new { text = "Текст заметки" })));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.Null(note!.Title);
        Assert.Equal("Текст заметки", note.Text);
    }

    [Fact]
    public async Task GetAll_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();
        await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, "/Notes?from=0&count=50", accessToken));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var notes = await response.Content.ReadFromJsonAsync<List<NoteSummaryResponse>>();
        Assert.NotNull(notes);
        Assert.Single(notes!);
        Assert.Equal("Заголовок", notes![0].Title);
    }

    [Fact]
    public async Task Search_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Список покупок", "Молоко и хлеб"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, "/Notes/search?query=покуп", accessToken));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var results = await response.Content.ReadFromJsonAsync<List<NoteSearchResultResponse>>();
        Assert.NotNull(results);
        var found = Assert.Single(results!);
        Assert.Equal(created!.Id, found.Id);
        Assert.Equal("Список покупок", string.Concat(found.Title.Select(segment => segment.Text)));
        Assert.Equal(["покуп"], found.Title.Where(segment => segment.Match).Select(segment => segment.Text));
    }

    [Fact]
    public async Task GetById_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, $"/Notes/{created!.Id}", accessToken));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.Equal(created.Id, note!.Id);
        Assert.Equal("Заголовок", note.Title);
        Assert.Equal("Текст заметки", note.Text);
    }

    [Fact]
    public async Task Update_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Старый заголовок", "Старый текст"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Put, $"/Notes/{created!.Id}", accessToken, JsonContent.Create(new UpdateNoteRequest("Новый заголовок", "Новый текст", created.Version))));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.Equal(created.Id, note!.Id);
        Assert.Equal("Новый заголовок", note.Title);
        Assert.Equal("Новый текст", note.Text);
        Assert.Equal(created.Version + 1, note.Version);
    }

    /// <summary>
    ///     Конфликт версий — единственное место, где виден его HTTP-код: сам
    ///     сценарий (устаревшая версия отклоняется) покрыт в UseCasesTests,
    ///     а маппинг в 409 живёт в DomainExceptionHandler и проверяем только
    ///     через реальный запрос. По той же причине здесь есть 401/403.
    /// </summary>
    [Fact]
    public async Task Update_WithStaleVersion_ReturnsConflict()
    {
        // Arrange
        var accessToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();
        await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Put, $"/Notes/{created!.Id}", accessToken, JsonContent.Create(new UpdateNoteRequest("Заголовок", "Правка из другой вкладки", created.Version))));

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Put, $"/Notes/{created.Id}", accessToken, JsonContent.Create(new UpdateNoteRequest("Заголовок", "Своя правка", created.Version))));

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        var getResponse = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, $"/Notes/{created.Id}", accessToken));
        var note = await getResponse.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.Equal("Правка из другой вкладки", note!.Text);
    }

    [Fact]
    public async Task Delete_BlueSky()
    {
        // Arrange
        var accessToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", accessToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Delete, $"/Notes/{created!.Id}", accessToken));

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, $"/Notes/{created.Id}", accessToken));
        Assert.Equal(HttpStatusCode.BadRequest, getResponse.StatusCode);
    }

    [Fact]
    public async Task GetById_ForNoteOwnedByAnotherUser_ReturnsForbidden()
    {
        // Arrange
        var ownerToken = await LoginAsync();
        var createResponse = await Sut.SendAsync(AuthorizedRequest(
            HttpMethod.Post, "/Notes", ownerToken, JsonContent.Create(new CreateNoteRequest("Заголовок", "Текст заметки"))));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var otherToken = await LoginAsync("other-user");
        var response = await Sut.SendAsync(AuthorizedRequest(HttpMethod.Get, $"/Notes/{created!.Id}", otherToken));

        // Assert
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetAll_WithoutAccessToken_ReturnsUnauthorized()
    {
        // Arrange
        // Act
        var response = await Sut.GetAsync("/Notes?from=0&count=50");

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
