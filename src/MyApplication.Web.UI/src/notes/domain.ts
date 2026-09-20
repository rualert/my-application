// Текст-заглушка только для показа (список, режим просмотра, плейсхолдер поля):
// в данные — и на сервер — он не попадает, у заметки без заголовка title === null.
export const UNTITLED_TITLE = "Без названия";

export function isUntitled(title: string | null): boolean {
  return title === null || title.trim() === "";
}

// Пустое (или из одних пробелов) поле заголовка уходит на сервер как null.
export function titleForRequest(draftTitle: string): string | null {
  return draftTitle.trim() === "" ? null : draftTitle;
}
