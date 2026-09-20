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
    /// <exception cref="NoteConflictException">
    ///     UPDATE не затронул ни одной строки, потому что версия заметки в базе
    ///     изменилась после её чтения (<c>Version</c> — токен параллелизма, см.
    ///     <see cref="NotesDbContext.OnModelCreating"/>). Закрывает гонку между
    ///     SELECT и UPDATE двух одновременных запросов: проверки версии в
    ///     <c>NoteService</c> для неё недостаточно.
    /// </exception>
    public async Task SaveChangesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException exception)
        {
            var conflictingNoteId = exception.Entries
                .Select(entry => entry.Entity)
                .OfType<Note>()
                .Select(note => note.Id)
                .FirstOrDefault();
            throw new NoteConflictException(conflictingNoteId);
        }
    }
}
