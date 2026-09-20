import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { NoteSearchResult } from "../../api/types";
import { searchNotes } from "../../api/notesApi";
import { notesKeys } from "../queryKeys";

// Меньше трёх символов — искать нечего, такой запрос сервер и не примет
// (см. docs/docs/notes/business-rules.md).
export const MIN_SEARCH_QUERY_LENGTH = 3;

// Запрос уходит не на каждое нажатие клавиши, а когда набор затих.
export const SEARCH_DEBOUNCE_MS = 300;

export interface NotesSearchState {
  // Набрано достаточно символов — поиск идёт, подсказку есть смысл показывать.
  isActive: boolean;
  results: NoteSearchResult[];
  isLoading: boolean;
  isError: boolean;
  // Выдача относится именно к тому, что набрано в поле сейчас, а не к прежнему
  // тексту, который ещё на экране, пока идёт задержка или запрос. Только на такую
  // выдачу можно опираться в действии вроде «открыть первую строку».
  isSettled: boolean;
  // Начинает новый заход в поле поиска: прежняя выдача больше не показывается,
  // поиск по тому же тексту выполняется заново (docs/docs/notes/web-ui.md).
  restart: () => void;
}

export function useNotesSearch(query: string): NotesSearchState {
  const trimmedQuery = query.trim();
  const [debouncedQuery] = useDebouncedValue(trimmedQuery, SEARCH_DEBOUNCE_MS);
  const [visit, setVisit] = useState(0);

  // Оба условия: пока идёт задержка, «стёртый» до двух символов запрос не должен
  // держать подсказку открытой на прежней выдаче.
  const isActive = trimmedQuery.length >= MIN_SEARCH_QUERY_LENGTH && debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  const search = useQuery({
    queryKey: notesKeys.search(debouncedQuery, visit),
    queryFn: ({ signal }) => searchNotes(debouncedQuery, signal),
    enabled: isActive,
    // Ничего не хранится между заходами в поле.
    gcTime: 0,
    // Пока грузится выдача по дописанному символу, на экране остаётся предыдущая —
    // подсказка не мигает пустотой на каждой букве. Но только в пределах одного
    // захода: новый заход начинается с пустого экрана и «Идёт поиск…».
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey.at(-1) === visit ? previousData : undefined,
  });

  const restart = useCallback(() => setVisit((current) => current + 1), []);

  return {
    isActive,
    results: isActive ? (search.data ?? []) : [],
    isLoading: isActive && search.isFetching && search.data === undefined,
    isError: isActive && search.isError,
    isSettled:
      isActive &&
      debouncedQuery === trimmedQuery &&
      !search.isPlaceholderData &&
      (search.isSuccess || search.isError),
    restart,
  };
}
