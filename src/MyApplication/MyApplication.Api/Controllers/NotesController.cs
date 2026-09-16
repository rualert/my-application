using Microsoft.AspNetCore.Mvc;
using MyApplication.Application.Notes;
using MyApplication.Api.Models;

namespace MyApplication.Api.Controllers;

/// <summary>
///     CRUD-операции над заметками. Исключения слоя Domain/Application
///     (см. <see cref="MyApplication.Domain.DomainException"/>) в 400 Bad
///     Request маппит глобальный обработчик — контроллеру ловить их не нужно.
/// </summary>
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

    /// <summary>
    ///     Создаёт новую заметку.
    /// </summary>
    /// <returns>Созданная заметка с кодом 201, либо 400 при нарушении бизнес-правил.</returns>
    [HttpPost]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NoteResponse>> Create(CreateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await _noteService.CreateAsync(request.Title, request.Text, cancellationToken);
        var response = ToResponse(note);
        return CreatedAtAction(nameof(GetById), new { id = response.Id }, response);
    }

    /// <summary>
    ///     Возвращает список всех заметок (без текста).
    /// </summary>
    /// <returns>Список кратких сведений о заметках.</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NoteSummaryResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NoteSummaryResponse>>> GetAll(CancellationToken cancellationToken)
    {
        var notes = await _noteService.GetAllAsync(cancellationToken);
        return Ok(notes.Select(ToSummaryResponse).ToArray());
    }

    /// <summary>
    ///     Возвращает заметку целиком по идентификатору.
    /// </summary>
    /// <returns>Заметка с кодом 200, либо 400, если она не найдена.</returns>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NoteResponse>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var note = await _noteService.GetByIdAsync(id, cancellationToken);
        return Ok(ToResponse(note));
    }

    /// <summary>
    ///     Обновляет заголовок и текст заметки.
    /// </summary>
    /// <returns>Обновлённая заметка с кодом 200, либо 400, если заметка не найдена или нарушены бизнес-правила.</returns>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(NoteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<NoteResponse>> Update(Guid id, UpdateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await _noteService.UpdateAsync(id, request.Title, request.Text, cancellationToken);
        return Ok(ToResponse(note));
    }

    /// <summary>
    ///     Удаляет заметку по идентификатору.
    /// </summary>
    /// <returns>204, либо 400, если заметка не найдена.</returns>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await _noteService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    private static NoteResponse ToResponse(NoteDetails note) =>
        new(note.Id, note.Title, note.Text, note.CreatedAt, note.UpdatedAt);

    private static NoteSummaryResponse ToSummaryResponse(NoteSummary note) =>
        new(note.Id, note.Title, note.CreatedAt, note.UpdatedAt);
}
