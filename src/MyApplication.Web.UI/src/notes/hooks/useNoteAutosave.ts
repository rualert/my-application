import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client";
import { getNote } from "../../api/notesApi";
import type { NoteDetails } from "../../api/types";
import { titleForRequest } from "../domain";
import { notesKeys } from "../queryKeys";
import type { SaveStatus } from "../saveStatusText";
import { useUpdateNote } from "./useUpdateNote";

const AUTOSAVE_DELAY_MS = 5000;
const CONFLICT_STATUS = 409;

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
  // Заметку изменили в другом месте, наше сохранение отклонено (см. ниже).
  hasConflict: boolean;
  // Отбросить свои правки и показать версию с сервера.
  reloadFromServer: () => void;
  // Сохранить свой вариант поверх серверного.
  overwriteWithMine: () => void;
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
//
// Каждое сохранение уходит вместе с версией заметки, от которой сделаны правки.
// Если её успели изменить в другом месте, сервер отвечает 409 — тогда
// автосохранение встаёт (иначе оно бесконечно повторяло бы отклонённый запрос),
// черновик остаётся нетронутым, а разрешает конфликт пользователь через
// reloadFromServer/overwriteWithMine (docs/docs/notes/web-ui.md,
// "Заметка изменена в другом месте").
export function useNoteAutosave(note: NoteDetails): NoteAutosave {
  const { mutateAsync: updateNote } = useUpdateNote();
  const queryClient = useQueryClient();
  const noteId = note.id;

  const [title, setTitleState] = useState(note.title ?? "");
  const [text, setTextState] = useState(note.text);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() => new Date(note.updatedAt));
  const [error, setError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  // draftRef всегда хранит самые свежие значения — сохранение читает из него в
  // момент отправки, а не из замыкания на момент постановки в очередь.
  const draftRef = useRef({ title: note.title ?? "", text: note.text });
  // Снимок последних значений, которые точно лежат на сервере: черновик
  // "грязный", пока отличается от него.
  const savedRef = useRef({ title: note.title ?? "", text: note.text });
  // Версия заметки, от которой сделаны правки в черновике.
  const versionRef = useRef(note.version);
  const timerRef = useRef<number | null>(null);
  // В каждый момент в полёте не больше одного запроса: два параллельных могут
  // дойти до сервера в обратном порядке, и старая версия перезапишет новую.
  const isSavingRef = useRef(false);
  const saveAgainRef = useRef(false);
  // Дублирует hasConflict: сохранение проверяет конфликт вне рендера.
  const conflictRef = useRef(false);

  const requestSave = useCallback(async () => {
    // Пока конфликт не разрешён, повторять тот же отклонённый запрос незачем.
    if (conflictRef.current) {
      return;
    }

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
            request: { title: titleForRequest(snapshot.title), text: snapshot.text, version: versionRef.current },
          });
          savedRef.current = snapshot;
          versionRef.current = updated.version;
          setLastSavedAt(new Date(updated.updatedAt));
          setError(null);
        } catch (saveError) {
          if (saveError instanceof ApiError && saveError.status === CONFLICT_STATUS) {
            conflictRef.current = true;
            setHasConflict(true);
            return;
          }
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

  // Заметка на сервере на текущий момент — обе кнопки разрешения конфликта
  // начинают с неё: одной нужно её содержимое, другой — её версия.
  const fetchServerNote = useCallback(async () => {
    const fresh = await getNote(noteId);
    queryClient.setQueryData(notesKeys.detail(noteId), fresh);
    return fresh;
  }, [noteId, queryClient]);

  const reloadFromServer = useCallback(() => {
    void (async () => {
      try {
        const fresh = await fetchServerNote();
        const serverDraft = { title: fresh.title ?? "", text: fresh.text };
        draftRef.current = { ...serverDraft };
        savedRef.current = { ...serverDraft };
        versionRef.current = fresh.version;
        setTitleState(serverDraft.title);
        setTextState(serverDraft.text);
        setLastSavedAt(new Date(fresh.updatedAt));
        setError(null);
        conflictRef.current = false;
        setHasConflict(false);
        // Заголовок в списке тоже мог измениться вместе с заметкой.
        void queryClient.invalidateQueries({ queryKey: notesKeys.list() });
      } catch (reloadError) {
        setError(reloadError instanceof Error ? reloadError.message : "Не удалось загрузить заметку");
      }
    })();
  }, [fetchServerNote, queryClient]);

  const overwriteWithMine = useCallback(() => {
    void (async () => {
      try {
        const fresh = await fetchServerNote();
        // Сохраняем от актуальной версии — тогда сервер примет наш вариант.
        // savedRef при этом равен серверному содержимому: если оно совпало с
        // черновиком, перезаписывать нечего и запроса не будет.
        versionRef.current = fresh.version;
        savedRef.current = { title: fresh.title ?? "", text: fresh.text };
        setError(null);
        conflictRef.current = false;
        setHasConflict(false);
      } catch (overwriteError) {
        setError(overwriteError instanceof Error ? overwriteError.message : "Не удалось загрузить заметку");
        return;
      }
      await requestSave();
    })();
  }, [fetchServerNote, requestSave]);

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

  return {
    title,
    text,
    setTitle,
    setText,
    flush,
    status,
    lastSavedAt,
    error,
    hasConflict,
    reloadFromServer,
    overwriteWithMine,
  };
}
