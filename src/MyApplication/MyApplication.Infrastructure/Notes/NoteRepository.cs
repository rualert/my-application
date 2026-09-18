using Microsoft.EntityFrameworkCore;
using MyApplication.Application.Notes;
using MyApplication.Domain.Notes;

namespace MyApplication.Infrastructure.Notes;

public class NoteRepository : INoteRepository
{
    private readonly NotesDbContext _context;

    /// <summary>
    ///     Создаёт репозиторий поверх переданного контекста EF Core.
    /// </summary>
    public NoteRepository(NotesDbContext context)
    {
        _context = context;
    }

    /// <summary>
    ///     Добавляет заметку в контекст EF Core (без сохранения).
    /// </summary>
    public async Task AddAsync(Note note, CancellationToken cancellationToken)
    {
        await _context.Notes.AddAsync(note, cancellationToken);
    }

    /// <summary>
    ///     Возвращает заметку по идентификатору, либо <c>null</c>, если она не найдена.
    /// </summary>
    public Task<Note?> GetByIdAsync(Guid id, CancellationToken cancellationToken)
    {
        return _context.Notes.SingleOrDefaultAsync(note => note.Id == id, cancellationToken);
    }

    /// <summary>
    ///     Возвращает страницу заметок пользователя <paramref name="userId"/>,
    ///     отсортированных от новых к старым: пропускает первые
    ///     <paramref name="from"/> заметок и возвращает не более
    ///     <paramref name="count"/> следующих.
    /// </summary>
    public async Task<IReadOnlyList<Note>> GetAllAsync(Guid userId, int from, int count, CancellationToken cancellationToken)
    {
        return await _context.Notes
            .AsNoTracking()
            .Where(note => note.UserId == userId)
            .OrderByDescending(note => note.CreatedAt)
            .Skip(from)
            .Take(count)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    ///     Помечает заметку на удаление в контексте EF Core (без сохранения).
    /// </summary>
    public void Remove(Note note)
    {
        _context.Notes.Remove(note);
    }

    /// <summary>
    ///     Сохраняет все изменения контекста EF Core в базе данных.
    /// </summary>
    public Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        return _context.SaveChangesAsync(cancellationToken);
    }
}
