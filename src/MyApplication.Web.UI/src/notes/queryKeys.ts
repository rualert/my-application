export const notesKeys = {
  all: ["notes"] as const,
  list: () => [...notesKeys.all, "list"] as const,
  detail: (id: string) => [...notesKeys.all, "detail", id] as const,
  search: (query: string) => [...notesKeys.all, "search", query] as const,
};
