import { useCallback, useState } from "react";

// Какая заметка открыта и просили ли поставить курсор в редактор. Живёт выше
// списка и шапки, потому что заметку выбирают и из списка, и из поиска в шапке.
export function useNoteSelection() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorFocusRequested, setEditorFocusRequested] = useState(false);

  // Любой выбор заметки (список, предпросмотр из поиска, удаление) снимает ещё не
  // исполненную просьбу поставить курсор: она относилась к прежней заметке.
  const select = useCallback((id: string | null) => {
    setSelectedNoteId(id);
    setEditorFocusRequested(false);
  }, []);

  // Просьба «курсор в редактор» может прийти раньше, чем загрузилась заметка, —
  // поэтому это флаг, который редактор снимает сам, когда смог его исполнить.
  const requestEditorFocus = useCallback(() => setEditorFocusRequested(true), []);
  const handleEditorFocusHandled = useCallback(() => setEditorFocusRequested(false), []);

  return { selectedNoteId, select, editorFocusRequested, requestEditorFocus, handleEditorFocusHandled };
}
