import { useDebouncedCallback } from "@mantine/hooks";
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
  status: SaveStatus;
  lastSavedAt: Date | null;
  error: string | null;
}

// Черновик заголовка/текста плюс автосохранение через AUTOSAVE_DELAY_MS
// простоя ввода (см. docs/docs/notes/overview.md, "Сохранение заметок").
export function useNoteAutosave(note: NoteDetails | undefined): NoteAutosave {
  const updateMutation = useUpdateNote();

  const [title, setTitleState] = useState("");
  const [text, setTextState] = useState("");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // draftRef всегда хранит самые свежие значения — debounce читает из него в
  // момент срабатывания, а не из замыкания на момент постановки в очередь.
  const draftRef = useRef({ title: "", text: "" });

  useEffect(() => {
    if (!note) {
      return;
    }
    const noteTitle = note.title ?? "";
    draftRef.current = { title: noteTitle, text: note.text };
    setTitleState(noteTitle);
    setTextState(note.text);
    setLastSavedAt(new Date(note.updatedAt));
    setStatus("idle");
    setError(null);
  }, [note]);

  const performSave = useCallback(() => {
    if (!note) {
      return;
    }
    const { title: draftTitle, text: draftText } = draftRef.current;

    setStatus("saving");
    updateMutation.mutate(
      { id: note.id, request: { title: titleForRequest(draftTitle), text: draftText } },
      {
        onSuccess: (updated) => {
          setStatus("idle");
          setLastSavedAt(new Date(updated.updatedAt));
          setError(null);
        },
        onError: (mutationError) => {
          setStatus("idle");
          setError(mutationError instanceof Error ? mutationError.message : "Не удалось сохранить");
        },
      },
    );
  }, [note, updateMutation]);

  const debouncedSave = useDebouncedCallback(performSave, AUTOSAVE_DELAY_MS);

  const setTitle = useCallback(
    (value: string) => {
      setTitleState(value);
      draftRef.current.title = value;
      debouncedSave();
    },
    [debouncedSave],
  );

  const setText = useCallback(
    (value: string) => {
      setTextState(value);
      draftRef.current.text = value;
      debouncedSave();
    },
    [debouncedSave],
  );

  return { title, text, setTitle, setText, status, lastSavedAt, error };
}
