using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MyApplication.Application.Notes;
using MyApplication.Api.Models;

namespace MyApplication.Api.Controllers;

/// <summary>
///     CRUD-операции над заметками. Заметки приватны — каждая операция
///     скоупится по вызывающему пользователю, извлечённому из JWT. Исключения
///     слоя Domain/Application (см. <see cref="MyApplication.Domain.DomainException"/>)
///     в 401/403/400 маппит глобальный обработчик — контроллеру ловить их не нужно.
/// </summary>
[Authorize]
[ApiController]
[Route("[controller]")]
public class NotesController : ControllerBase
{
    private readonly INoteService _noteService;

    /// <summary>
    ///     Создаёт экземпляр контроллера с внедрённым сервисом заметок.
    /// </summary>
    public NotesController(INoteService noteService)
    {
        _noteService = noteService;
    }

    private Guid CallerUserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    ///     Создаёт новую заметку.
    /// </summary>
    /// <returns>Созданная заметка с кодом 201, либо 400 при нарушении бизнес-правил.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<NoteResponse>> Create(CreateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await _noteService.CreateAsync(CallerUserId, request.Title, request.Text, cancellationToken);
        var response = ToResponse(note);
        return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
    }

    /// <summary>
    ///     Возвращает страницу заметок (без текста), отсортированных от новых к старым.
    /// </summary>
    /// <param name="from">Сколько заметок пропустить с начала списка. По умолчанию 0.</param>
    /// <param name="count">Сколько заметок вернуть. По умолчанию 50.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Список кратких сведений о заметках, либо 400 при невалидных from/count.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NoteSummaryResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<NoteSummaryResponse>>> GetAll(
        [FromQuery] int from = 0,
        [FromQuery] int count = 50,
        CancellationToken cancellationToken = default)
    {
        var notes = await _noteService.GetAllAsync(CallerUserId, from, count, cancellationToken);
        return Ok(notes.Select(ToSummaryResponse).ToArray());
    }

    /// <summary>
    ///     Ищет заметки по заголовку и тексту, от более релевантных к менее.
    ///     Путь с <see cref="GetById"/> не конфликтует: там идентификатор —
    ///     только GUID, и <c>search</c> под это ограничение не подходит.
    /// </summary>
    /// <param name="query">Что искать. Не короче 3 символов.</param>
    /// <param name="cancellationToken"></param>
    /// <returns>Найденные заметки с кодом 200 (не более 10), либо 400 при слишком коротком запросе.</returns>
    [HttpGet("search")]
    [ProducesResponseType(typeof(IReadOnlyList<NoteSearchResultResponse>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<NoteSearchResultResponse>>> Search(
        [FromQuery] string query = "",
        CancellationToken cancellationToken = default)
    {
        var results = await _noteService.SearchAsync(CallerUserId, query, cancellationToken);
        return Ok(results.Select(ToSearchResultResponse).ToArray());
    }

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    /// <returns>Заметка с кодом 200, либо 400, если она не найдена, либо 403, если она принадлежит другому пользователю.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<NoteResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var note = await _noteService.GetByIdAsync(CallerUserId, id, cancellationToken);
        return Ok(ToResponse(note));
    }

    /// <summary>
    ///     Обновляет заголовок и текст заметки.
    /// </summary>
    /// <returns>Обновлённая заметка с кодом 200, либо 400, если заметка не найдена или нарушены бизнес-правила, либо 403, если она принадлежит другому пользователю, либо 409, если заметку изменили с версии, указанной в запросе.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NoteResponse>> Update(Guid id, UpdateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await _noteService.UpdateAsync(CallerUserId, id, request.Title, request.Text, request.Version, cancellationToken);
        return Ok(ToResponse(note));
    }

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <returns>204, либо 400, если заметка не найдена, либо 403, если она принадлежит другому пользователю.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _noteService.DeleteAsync(CallerUserId, id, cancellationToken);
        return NoContent();
    }

    private static NoteResponse ToResponse(NoteDetails note) =>
        new(note.Id, note.Title, note.Text, note.Version, note.CreatedAt, note.UpdatedAt);

    private static NoteSummaryResponse ToSummaryResponse(NoteSummary note) =>
        new(note.Id, note.Title, note.CreatedAt, note.UpdatedAt);

    private static NoteSearchResultResponse ToSearchResultResponse(NoteSearchResult result) =>
        new(result.Id, ToSegmentResponses(result.Title), ToSegmentResponses(result.Snippet));

    private static IReadOnlyList<HighlightedSegmentResponse> ToSegmentResponses(IReadOnlyList<HighlightedSegment> segments) =>
        segments.Select(segment => new HighlightedSegmentResponse(segment.Text, segment.Match)).ToArray();
}
