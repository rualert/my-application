import { useDebouncedValue } from "@mantine/hooks";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { NoteSearchResult } from "../../api/types";
import { searchNotes } from "../../api/notesApi";
import { notesKeys } from "../queryKeys";

// Меньше трёх символов — искать нечего, такой запрос сервер и не примет
// (см. docs/docs/notes/business-rules.md).
export const MIN_SEARCH_QUERY_LENGTH = 3;

// Запрос уходит не на каждое нажатие клавиши, а когда набор затих.
export const SEARCH_DEBOUNCE_MS = 300;

export interface NotesSearchState {
  // Запрос достаточно длинный — поиск идёт, подсказку есть смысл показывать.
  isActive: boolean;
  results: NoteSearchResult[];
  isLoading: boolean;
  isError: boolean;
}

export function useNotesSearch(query: string): NotesSearchState {
  const [debouncedQuery] = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const isActive = debouncedQuery.length >= MIN_SEARCH_QUERY_LENGTH;

  // keepPreviousData: пока грузится выдача по дописанному символу, на экране
  // остаётся предыдущая — подсказка не мигает пустотой на каждой букве.
  const search = useQuery({
    queryKey: notesKeys.search(debouncedQuery),
    queryFn: ({ signal }) => searchNotes(debouncedQuery, signal),
    enabled: isActive,
    placeholderData: keepPreviousData,
  });

  return {
    isActive,
    results: isActive ? (search.data ?? []) : [],
    isLoading: isActive && search.isFetching && search.data === undefined,
    isError: isActive && search.isError,
  };
}
