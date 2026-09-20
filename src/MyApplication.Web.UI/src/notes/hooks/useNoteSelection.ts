import { useCallback, useState } from "react";

// Куда поставить курсор в редакторе: в заголовок (новая заметка) или в начало текста
// (зафиксирован выбор в поиске).
export type EditorFocusTarget = "title" | "text";

// Какая заметка открыта и просили ли поставить курсор в редактор. Живёт выше
// списка и шапки, потому что заметку выбирают и из списка, и из поиска в шапке.
export function useNoteSelection() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorFocus, setEditorFocus] = useState<EditorFocusTarget | null>(null);

  // Любой выбор заметки (список, предпросмотр из поиска, удаление) снимает ещё не
  // исполненную просьбу поставить курсор: она относилась к прежней заметке.
  const select = useCallback((id: string | null) => {
    setSelectedNoteId(id);
    setEditorFocus(null);
  }, []);

  // Только что созданная заметка: открыть её и поставить курсор в заголовок.
  const selectCreated = useCallback((id: string) => {
    setSelectedNoteId(id);
    setEditorFocus("title");
  }, []);

  // Просьба «курсор в начало текста» может прийти раньше, чем загрузилась заметка, —
  // поэтому это не событие, а состояние, которое редактор снимает сам, когда смог
  // его исполнить.
  const requestTextFocus = useCallback(() => setEditorFocus("text"), []);
  const handleEditorFocusHandled = useCallback(() => setEditorFocus(null), []);

  return { selectedNoteId, select, selectCreated, editorFocus, requestTextFocus, handleEditorFocusHandled };
}
