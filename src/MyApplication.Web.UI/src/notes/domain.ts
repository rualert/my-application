export const UNTITLED_TITLE = "Без заголовка";

export function displayTitle(title: string): string {
  return title.trim() === "" ? UNTITLED_TITLE : title;
}
