import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { updateNote } from "../../api/notesApi";
import type { NoteSummary, UpdateNoteRequest } from "../../api/types";
import { notesKeys } from "../queryKeys";

interface UpdateNoteVariables {
  id: string;
  request: UpdateNoteRequest;
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, request }: UpdateNoteVariables) => updateNote(id, request),
    onSuccess: (updated) => {
      queryClient.setQueryData(notesKeys.detail(updated.id), updated);

      queryClient.setQueryData<InfiniteData<NoteSummary[], number>>(notesKeys.list(), (data) => {
        if (!data) {
          return data;
        }
        return {
          ...data,
          pages: data.pages.map((page) =>
            page.map((note) =>
              note.id === updated.id
                ? { id: updated.id, title: updated.title, createdAt: updated.createdAt, updatedAt: updated.updatedAt }
                : note,
            ),
          ),
        };
      });
    },
  });
}
