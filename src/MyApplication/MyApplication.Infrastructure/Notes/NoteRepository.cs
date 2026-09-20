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
    ///     Возвращает не более <paramref name="limit"/> заметок пользователя
    ///     <paramref name="userId"/>, в которых нашёлся <paramref name="query"/>,
    ///     от более релевантных к менее (правила отбора и порядка — см.
    ///     <see cref="INoteRepository.SearchAsync"/>).
    ///     Считается всё это в самой БД: отсортировать по релевантности и взять
    ///     первые несколько иначе означало бы вычитать в память все заметки
    ///     пользователя.
    ///     Точное вхождение ищется через ILIKE, неточное — через оператор <c>&lt;%</c>
    ///     расширения pg_trgm: он истинен, когда внутри строки находится достаточно
    ///     похожий на запрос фрагмент. Веса подобраны так, чтобы точность совпадения
    ///     была важнее поля, в котором оно нашлось: заметка с точным вхождением в
    ///     тексте идёт выше заметки, у которой на запрос лишь похож заголовок.
    /// </summary>
    public async Task<IReadOnlyList<Note>> SearchAsync(Guid userId, string query, int limit, CancellationToken cancellationToken)
    {
        var pattern = $"%{EscapeLikePattern(query)}%";

        // Схема в FROM записана литералом (имя схемы нельзя передать параметром) —
        // она должна совпадать с NotesDbContext.SchemaName.
        return await _context.Notes
            .FromSql($"""
                      SELECT n.*
                      FROM notes.notes AS n
                      WHERE n."UserId" = {userId}
                        AND (n."Title" ILIKE {pattern}
                          OR n."Text" ILIKE {pattern}
                          OR {query} <% coalesce(n."Title", '')
                          OR {query} <% n."Text")
                      ORDER BY 4.0 * (CASE WHEN n."Title" ILIKE {pattern} THEN 1 ELSE 0 END)
                             + 2.0 * (CASE WHEN n."Text" ILIKE {pattern} THEN 1 ELSE 0 END)
                             + 1.5 * word_similarity({query}, coalesce(n."Title", ''))
                             + 1.0 * word_similarity({query}, n."Text") DESC,
                               n."UpdatedAt" DESC
                      LIMIT {limit}
                      """)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    ///     Экранирует символы, которые ILIKE считает подстановочными, чтобы запрос
    ///     вроде <c>50%</c> искался буквально. Экранирующий символ в PostgreSQL по
    ///     умолчанию — обратная косая черта.
    /// </summary>
    private static string EscapeLikePattern(string query) => query
        .Replace("\\", "\\\\")
        .Replace("%", "\\%")
        .Replace("_", "\\_");

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
