using System.Net;
using System.Net.Http.Json;
using MyApplication.Api.Models;
using MyApplication.Tests.SmokeTests.Harness;

namespace MyApplication.Tests.SmokeTests;

/// <summary>
///     Смок-тесты фичи «Заметки»: только blue sky сценарии, по одному на
///     операцию, через реальный HTTP — весь сервис целиком как чёрный ящик,
///     без обращения к деталям реализации.
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
        // Act
        var response = await Sut.PostAsJsonAsync("/Notes", new CreateNoteRequest("Заголовок", "Текст заметки"));

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.NotEqual(Guid.Empty, note!.Id);
        Assert.Equal("Заголовок", note.Title);
        Assert.Equal("Текст заметки", note.Text);
    }

    [Fact]
    public async Task GetAll_BlueSky()
    {
        // Arrange
        await Sut.PostAsJsonAsync("/Notes", new CreateNoteRequest("Заголовок", "Текст заметки"));

        // Act
        var response = await Sut.GetAsync("/Notes?from=0&count=50");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var notes = await response.Content.ReadFromJsonAsync<List<NoteSummaryResponse>>();
        Assert.NotNull(notes);
        Assert.Single(notes!);
        Assert.Equal("Заголовок", notes![0].Title);
    }

    [Fact]
    public async Task GetById_BlueSky()
    {
        // Arrange
        var createResponse = await Sut.PostAsJsonAsync("/Notes", new CreateNoteRequest("Заголовок", "Текст заметки"));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.GetAsync($"/Notes/{created!.Id}");

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
        var createResponse = await Sut.PostAsJsonAsync("/Notes", new CreateNoteRequest("Старый заголовок", "Старый текст"));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.PutAsJsonAsync($"/Notes/{created!.Id}", new UpdateNoteRequest("Новый заголовок", "Новый текст"));

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var note = await response.Content.ReadFromJsonAsync<NoteResponse>();
        Assert.NotNull(note);
        Assert.Equal(created.Id, note!.Id);
        Assert.Equal("Новый заголовок", note.Title);
        Assert.Equal("Новый текст", note.Text);
    }

    [Fact]
    public async Task Delete_BlueSky()
    {
        // Arrange
        var createResponse = await Sut.PostAsJsonAsync("/Notes", new CreateNoteRequest("Заголовок", "Текст заметки"));
        var created = await createResponse.Content.ReadFromJsonAsync<NoteResponse>();

        // Act
        var response = await Sut.DeleteAsync($"/Notes/{created!.Id}");

        // Assert
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await Sut.GetAsync($"/Notes/{created.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, getResponse.StatusCode);
    }
}
