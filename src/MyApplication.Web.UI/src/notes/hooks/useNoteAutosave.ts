import { useCallback, useEffect, useRef, useState } from "react";
import type { NoteDetails } from "../../api/types";
import { titleForRequest } from "../domain";
import type { SaveStatus } from "../saveStatusText";
import { useUpdateNote } from "./useUpdateNote";

const AUTOSAVE_DELAY_MS = 5000;

export interface NoteAutosave {
  title: string;
  text: string;
  setTitle: (value: string) => void;
  setText: (value: string) => void;
  // Сохраняет несохранённые изменения немедленно, не дожидаясь таймера.
  flush: () => void;
  status: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
}

// Черновик заголовка/текста плюс автосохранение (docs/docs/notes/web-ui.md,
// "Сохранение заметок"): через AUTOSAVE_DELAY_MS после первого несохранённого
// изменения (последующий набор таймер не сдвигает), а также сразу по flush() —
// потеря фокуса, уход со вкладки, размонтирование (смена заметки).
//
// Начальные значения берутся из note один раз: компонент с этим хуком
// монтируется заново для каждой заметки (key={note.id}), а обновления кэша —
// например, ответ на наше же сохранение — не должны затирать то, что
// пользователь успел напечатать.
export function useNoteAutosave(note: NoteDetails): NoteAutosave {
  const { mutateAsync: updateNote } = useUpdateNote();
  const noteId = note.id;

  const [title, setTitleState] = useState(note.title ?? "");
  const [text, setTextState] = useState(note.text);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => new Date(note.updatedAt));
  const [error, setError] = useState<string | null>(null);

  // draftRef всегда хранит самые свежие значения — сохранение читает из него в
  // момент отправки, а не из замыкания на момент постановки в очередь.
  const draftRef = useRef({ title: note.title ?? "", text: note.text });
  // Снимок последних значений, которые точно лежат на сервере: черновик
  // "грязный", пока отличается от него.
  const savedRef = useRef({ title: note.title ?? "", text: note.text });
  const timerRef = useRef<number | null>(null);
  // В каждый момент в полёте не больше одного запроса: два параллельных могут
  // дойти до сервера в обратном порядке, и старая версия перезапишет новую.
  const isSavingRef = useRef(false);
  const saveAgainRef = useRef(false);

  const requestSave = useCallback(async () => {
    if (isSavingRef.current) {
      saveAgainRef.current = true;
      return;
    }

    isSavingRef.current = true;
    try {
      do {
        saveAgainRef.current = false;
        const snapshot = { ...draftRef.current };
        if (snapshot.title === savedRef.current.title && snapshot.text === savedRef.current.text) {
          return;
        }

        setStatus("saving");
        try {
          const updated = await updateNote({
            id: noteId,
            request: { title: titleForRequest(snapshot.title), text: snapshot.text },
          });
          savedRef.current = snapshot;
          setLastSavedAt(new Date(updated.updatedAt));
          setError(null);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить");
          return;
        }
        // Запрос ещё раз просили, пока предыдущий был в полёте (сработал таймер
        // или blur) — отправляем то, что успело накопиться.
      } while (saveAgainRef.current);
    } finally {
      isSavingRef.current = false;
      setStatus("idle");
    }
  }, [noteId, updateNote]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    void requestSave();
  }, [requestSave]);

  // Таймер запускается только первым изменением после сохранения; пока он
  // тикает, новые нажатия его не трогают.
  const scheduleSave = useCallback(() => {
    if (timerRef.current !== null) {
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void requestSave();
    }, AUTOSAVE_DELAY_MS);
  }, [requestSave]);

  // Размонтирование (переход на другую заметку, удаление, выход) — досохраняем.
  useEffect(() => flush, [flush]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [flush]);

  const setTitle = useCallback(
    (value: string) => {
      setTitleState(value);
      draftRef.current.title = value;
      scheduleSave();
    },
    [scheduleSave],
  );

  const setText = useCallback(
    (value: string) => {
      setTextState(value);
      draftRef.current.text = value;
      scheduleSave();
    },
    [scheduleSave],
  );

  return { title, text, setTitle, setText, flush, status, lastSavedAt, error };
}
