import { useEffect, useRef } from "react";

/**
 * Сочетание клавиш приложения (docs/docs/notes/web-ui.md, «Горячие клавиши»).
 *
 * Клавиша задаётся физическим положением (`event.code`), а не набранным символом:
 * в русской раскладке `event.key` у той же клавиши — «т», и сравнение по символу
 * ломало бы сочетание ровно у тех пользователей, ради которых оно и делалось.
 * `mod` — Ctrl на Windows/Linux и Cmd на Mac.
 */
export interface Hotkey {
  code: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/**
 * Слушает сочетание на всём окне — в том числе когда курсор стоит в заголовке или
 * тексте заметки: горячие клавиши приложения должны работать из редактора, а не
 * только мимо него. Поэтому все они с модификатором: одиночная буква здесь просто
 * печаталась бы.
 */
export function useHotkey(hotkey: Hotkey, handler: () => void) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });

  const { code, mod = false, alt = false, shift = false } = hotkey;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Зажатая клавиша шлёт повторы keydown — это не новое нажатие.
      if (event.code !== code || event.repeat) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) !== mod || event.altKey !== alt || event.shiftKey !== shift) {
        return;
      }
      event.preventDefault();
      handlerRef.current();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [code, mod, alt, shift]);
}
