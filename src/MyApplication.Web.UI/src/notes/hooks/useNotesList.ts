import { useInfiniteQuery } from "@tanstack/react-query";
import { listNotes } from "../../api/notesApi";
import { notesKeys } from "../queryKeys";

export const NOTES_PAGE_SIZE = 30;

export function useNotesList() {
  return useInfiniteQuery({
    queryKey: notesKeys.list(),
    queryFn: ({ pageParam, signal }) => listNotes(pageParam, NOTES_PAGE_SIZE, signal),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < NOTES_PAGE_SIZE ? undefined : allPages.length * NOTES_PAGE_SIZE,
  });
}
