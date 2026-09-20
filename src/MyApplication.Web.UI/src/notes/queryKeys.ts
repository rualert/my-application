export const notesKeys = {
  all: ["notes"] as const,
  list: () => [...notesKeys.all, "list"] as const,
  detail: (id: string) => [...notesKeys.all, "detail", id] as const,
  // visit — номер «захода» в поле поиска: каждое возвращение в поле начинает
  // новый заход и тем самым новый запрос, так что прежняя выдача не переиспользуется.
  search: (query: string, visit: number) => [...notesKeys.all, "search", query, visit] as const,
};
