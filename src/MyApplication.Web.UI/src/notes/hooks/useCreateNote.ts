import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { createNote } from "../../api/notesApi";
import type { NoteSummary } from "../../api/types";
import { notesKeys } from "../queryKeys";

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNote,
    onSuccess: (created) => {
      queryClient.setQueryData(notesKeys.detail(created.id), created);

      const summary: NoteSummary = {
        id: created.id,
        title: created.title,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };

      queryClient.setQueryData<InfiniteData<NoteSummary[], number>>(notesKeys.list(), (data) => {
        if (!data) {
          return data;
        }
        const [firstPage, ...restPages] = data.pages;
        return { ...data, pages: [[summary, ...firstPage], ...restPages] };
      });
    },
  });
}
