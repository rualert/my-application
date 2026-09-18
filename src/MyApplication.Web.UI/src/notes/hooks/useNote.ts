import { useQuery } from "@tanstack/react-query";
import { getNote } from "../../api/notesApi";
import { notesKeys } from "../queryKeys";

export function useNote(id: string | null) {
  return useQuery({
    queryKey: notesKeys.detail(id ?? ""),
    queryFn: ({ signal }) => getNote(id as string, signal),
    enabled: id !== null,
  });
}
