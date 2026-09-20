using System.Text;

namespace MyApplication.Application.Notes;

/// <summary>
///     Готовит то, что показывается в результате поиска: заголовок заметки и
///     фрагмент её текста вокруг совпадения, с отмеченными местами самих
///     совпадений.
///     Совпадение ищется так же, как его ищет хранилище: сначала точное
///     вхождение запроса, а если его нет — наиболее похожий на запрос фрагмент
///     (заметка могла найтись по опечатке, и тогда точного вхождения в ней нет).
/// </summary>
public static class SearchSnippetBuilder
{
    /// <summary>
    ///     Сколько примерно символов текста показывается вокруг совпадения.
    ///     Края фрагмента подгоняются под границы слов, поэтому длина
    ///     получается близкой к этой, но не точно равной ей.
    /// </summary>
    public const int SnippetLength = 150;

    /// <summary>
    ///     Минимальная похожесть фрагмента на запрос, ниже которой он не считается
    ///     совпадением. Порог мягче того, по которому хранилище отбирает заметки:
    ///     заметка сюда уже попала, остаётся показать, где именно в ней нашлось.
    /// </summary>
    private const double MinSimilarity = 0.3;

    private const string EllipsisText = "…";

    private static readonly IReadOnlyList<HighlightedSegment> Empty = Array.Empty<HighlightedSegment>();

    /// <summary>
    ///     Размечает совпадения в заголовке заметки. У заметки без заголовка
    ///     результат пуст.
    /// </summary>
    public static IReadOnlyList<HighlightedSegment> HighlightTitle(string? title, string query)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Empty;
        }

        var value = CollapseWhitespace(title);
        return ToSegments(value, FindMatch(value, query));
    }

    /// <summary>
    ///     Вырезает из текста заметки фрагмент вокруг совпадения и размечает в нём
    ///     само совпадение. Обрезанные края обозначаются многоточием. Если
    ///     совпадения в тексте нет (заметка нашлась по заголовку), берётся начало
    ///     текста без разметки.
    /// </summary>
    public static IReadOnlyList<HighlightedSegment> BuildSnippet(string text, string query)
    {
        var value = CollapseWhitespace(text);
        if (value.Length == 0)
        {
            return Empty;
        }

        var match = FindMatch(value, query);
        var (windowStart, windowEnd) = SelectWindow(value, match);

        var prefix = windowStart > 0 ? EllipsisText : string.Empty;
        var suffix = windowEnd < value.Length ? EllipsisText : string.Empty;
        var window = prefix + value[windowStart..windowEnd] + suffix;

        var matchInWindow = match is null
            ? null
            : ((int Start, int Length)?)(match.Value.Start - windowStart + prefix.Length, match.Value.Length);

        return ToSegments(window, matchInWindow);
    }

    /// <summary>
    ///     Ищет место совпадения: сначала точное вхождение запроса (без учёта
    ///     регистра), затем — самый похожий на запрос фрагмент.
    /// </summary>
    private static (int Start, int Length)? FindMatch(string value, string query)
    {
        var exact = value.IndexOf(query, StringComparison.OrdinalIgnoreCase);
        return exact >= 0
            ? (exact, query.Length)
            : FindSimilar(value, query);
    }

    /// <summary>
    ///     Перебирает фрагменты из стольких же слов, сколько в запросе, и выбирает
    ///     самый похожий на запрос по триграммам — тем же способом, каким ищет
    ///     хранилище.
    /// </summary>
    private static (int Start, int Length)? FindSimilar(string value, string query)
    {
        var queryTrigrams = Trigrams(query);
        if (queryTrigrams.Count == 0)
        {
            return null;
        }

        var words = SplitWords(value);
        if (words.Count == 0)
        {
            return null;
        }

        var windowWords = Math.Min(Math.Max(SplitWords(query).Count, 1), words.Count);
        var bestSimilarity = MinSimilarity;
        (int Start, int Length)? bestMatch = null;

        for (var index = 0; index + windowWords <= words.Count; index++)
        {
            var start = words[index].Start;
            var last = words[index + windowWords - 1];
            var length = last.Start + last.Length - start;

            // Дешёвая отсечка: похожесть не может превысить отношение длин фрагмента
            // и запроса, так что сильно отличающиеся по длине фрагменты даже не считаем.
            if (Math.Min(length, query.Length) < MinSimilarity * Math.Max(length, query.Length))
            {
                continue;
            }

            var similarity = Similarity(queryTrigrams, Trigrams(value.Substring(start, length)));
            if (similarity > bestSimilarity)
            {
                bestSimilarity = similarity;
                bestMatch = (start, length);
            }
        }

        return bestMatch;
    }

    /// <summary>
    ///     Выбирает границы фрагмента: совпадение по центру, края — по границам слов
    ///     и не залезая внутрь самого совпадения.
    /// </summary>
    private static (int Start, int End) SelectWindow(string value, (int Start, int Length)? match)
    {
        if (value.Length <= SnippetLength)
        {
            return (0, value.Length);
        }

        var (matchStart, matchLength) = match ?? (0, 0);
        var padding = (SnippetLength - Math.Min(matchLength, SnippetLength)) / 2;
        var start = Math.Clamp(matchStart - padding, 0, value.Length - SnippetLength);
        var end = Math.Max(start + SnippetLength, Math.Min(value.Length, matchStart + matchLength));

        return (MoveToWordStart(value, start, matchStart), MoveToWordEnd(value, end, matchStart + matchLength));
    }

    /// <summary>
    ///     Сдвигает левый край вперёд до начала слова, но не дальше начала совпадения.
    /// </summary>
    private static int MoveToWordStart(string value, int start, int limit)
    {
        while (start > 0 && start < limit && !char.IsWhiteSpace(value[start - 1]))
        {
            start++;
        }

        return start;
    }

    /// <summary>
    ///     Сдвигает правый край назад до конца слова, но не дальше конца совпадения.
    /// </summary>
    private static int MoveToWordEnd(string value, int end, int limit)
    {
        while (end < value.Length && end > limit && !char.IsWhiteSpace(value[end]))
        {
            end--;
        }

        return end;
    }

    private static IReadOnlyList<HighlightedSegment> ToSegments(string value, (int Start, int Length)? match)
    {
        if (match is not { Length: > 0 } found)
        {
            return new[] { new HighlightedSegment(value, false) };
        }

        var segments = new List<HighlightedSegment>(3);
        if (found.Start > 0)
        {
            segments.Add(new HighlightedSegment(value[..found.Start], false));
        }

        segments.Add(new HighlightedSegment(value.Substring(found.Start, found.Length), true));

        var end = found.Start + found.Length;
        if (end < value.Length)
        {
            segments.Add(new HighlightedSegment(value[end..], false));
        }

        return segments;
    }

    /// <summary>
    ///     Схлопывает пробелы и переводы строк в один пробел: фрагмент текста
    ///     показывается одной строкой, а разметка заметки в нём роли не играет.
    /// </summary>
    private static string CollapseWhitespace(string value)
    {
        var builder = new StringBuilder(value.Length);
        var previousWasWhitespace = false;

        foreach (var character in value)
        {
            if (char.IsWhiteSpace(character))
            {
                if (!previousWasWhitespace && builder.Length > 0)
                {
                    builder.Append(' ');
                }

                previousWasWhitespace = true;
                continue;
            }

            builder.Append(character);
            previousWasWhitespace = false;
        }

        return builder.ToString().TrimEnd();
    }

    /// <summary>
    ///     Разбивает строку на слова, возвращая их положение в ней.
    /// </summary>
    private static List<(int Start, int Length)> SplitWords(string value)
    {
        var words = new List<(int Start, int Length)>();
        var index = 0;

        while (index < value.Length)
        {
            if (!char.IsLetterOrDigit(value[index]))
            {
                index++;
                continue;
            }

            var start = index;
            while (index < value.Length && char.IsLetterOrDigit(value[index]))
            {
                index++;
            }

            words.Add((start, index - start));
        }

        return words;
    }

    /// <summary>
    ///     Набор триграмм строки — так же, как их считает pg_trgm: по каждому слову
    ///     отдельно, с двумя пробелами в начале и одним в конце.
    /// </summary>
    private static HashSet<string> Trigrams(string value)
    {
        var trigrams = new HashSet<string>();

        foreach (var (start, length) in SplitWords(value))
        {
            var word = "  " + value.Substring(start, length).ToLowerInvariant() + " ";
            for (var index = 0; index + 3 <= word.Length; index++)
            {
                trigrams.Add(word.Substring(index, 3));
            }
        }

        return trigrams;
    }

    /// <summary>
    ///     Доля общих триграмм: количество совпавших, делённое на количество всех
    ///     различных триграмм обеих строк.
    /// </summary>
    private static double Similarity(HashSet<string> left, HashSet<string> right)
    {
        if (left.Count == 0 || right.Count == 0)
        {
            return 0;
        }

        var shared = right.Count(left.Contains);
        return (double)shared / (left.Count + right.Count - shared);
    }
}
