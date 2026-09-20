import { useEffect, useRef } from "react";

// Два нажатия Shift не дальше друг от друга, чем это время, считаются двойным.
export const DOUBLE_SHIFT_INTERVAL_MS = 300;

// Двойное нажатие Shift в любом месте страницы, в том числе из поля ввода
// (docs/docs/notes/web-ui.md, «Быстрый переход в поиск»). «Двойное» — это два Shift
// подряд: любая другая клавиша между ними обрывает счёт, иначе быстрый набор с заглавными
// («ПрИвет») выдёргивал бы курсор из редактора. Shift вместе с Ctrl/Alt/Meta не считается:
// это переключение раскладки (Alt+Shift, Ctrl+Shift) и сочетания приложений.
export function useDoubleShift(onDoubleShift: () => void) {
  const handlerRef = useRef(onDoubleShift);
  useEffect(() => {
    handlerRef.current = onDoubleShift;
  });

  useEffect(() => {
    let previousShiftAt: number | null = null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Shift" || event.ctrlKey || event.altKey || event.metaKey) {
        previousShiftAt = null;
        return;
      }
      // Зажатый Shift шлёт повторы keydown — это не новое нажатие.
      if (event.repeat) {
        return;
      }
      const now = Date.now();
      if (previousShiftAt !== null && now - previousShiftAt <= DOUBLE_SHIFT_INTERVAL_MS) {
        previousShiftAt = null;
        handlerRef.current();
      } else {
        previousShiftAt = now;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
