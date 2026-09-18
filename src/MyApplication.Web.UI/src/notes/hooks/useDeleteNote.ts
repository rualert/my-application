import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { deleteNote } from "../../api/notesApi";
import type { NoteSummary } from "../../api/types";
import { notesKeys } from "../queryKeys";

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNote(id),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: notesKeys.detail(id) });

      queryClient.setQueryData<InfiniteData<NoteSummary[], number>>(notesKeys.list(), (data) => {
        if (!data) {
          return data;
        }
        return { ...data, pages: data.pages.map((page) => page.filter((note) => note.id !== id)) };
      });
    },
  });
}
