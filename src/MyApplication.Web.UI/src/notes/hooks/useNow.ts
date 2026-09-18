import { useEffect, useState } from "react";

// Заставляет компонент перерисовываться раз в intervalMs — нужно, чтобы текст
// вида "Сохранение: N минут назад" сам обновлялся со временем без действий пользователя.
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
