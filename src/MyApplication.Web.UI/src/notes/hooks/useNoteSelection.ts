import { useCallback, useState } from "react";

// Куда поставить курсор в редакторе: в заголовок (новая заметка) или в начало текста
// (зафиксирован выбор в поиске).
export type EditorFocusTarget = "title" | "text";

// Какой из двух экранов показан на телефоне: там список и редактор не помещаются
// рядом и сменяют друг друга (docs/docs/notes/web-ui.md, «Интерфейс для телефона»).
// На широком экране не значит ничего — видны оба.
export type MobilePane = "list" | "editor";

// Какая заметка открыта и просили ли поставить курсор в редактор. Живёт выше
// списка и шапки, потому что заметку выбирают и из списка, и из поиска в шапке.
export function useNoteSelection() {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [editorFocus, setEditorFocus] = useState<EditorFocusTarget | null>(null);
  // Здесь же, а не в NotesApp: открывают заметку и из списка, и из поиска в шапке —
  // то есть с обеих сторон от него, — а возвращаются к списку из редактора.
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");

  // Любой выбор заметки (список, предпросмотр из поиска) снимает ещё не исполненную
  // просьбу поставить курсор: она относилась к прежней заметке.
  const select = useCallback((id: string | null) => {
    setSelectedNoteId(id);
    setEditorFocus(null);
    setMobilePane(id === null ? "list" : "editor");
  }, []);

  // Только что созданная заметка: открыть её и поставить курсор в заголовок.
  const selectCreated = useCallback((id: string) => {
    setSelectedNoteId(id);
    setEditorFocus("title");
    setMobilePane("editor");
  }, []);

  // После удаления тоже открывается заметка — соседняя, — но на телефоне остаёмся
  // в списке: удаляли, стоя в нём, там же логично и продолжать. Поэтому отдельный
  // путь, а не select.
  const selectAfterDelete = useCallback((id: string | null) => {
    setSelectedNoteId(id);
    setEditorFocus(null);
    setMobilePane("list");
  }, []);

  // Кнопка «Назад» в тулбаре редактора: выбор заметки при этом сохраняется.
  const showList = useCallback(() => setMobilePane("list"), []);

  // Просьба «курсор в начало текста» может прийти раньше, чем загрузилась заметка, —
  // поэтому это не событие, а состояние, которое редактор снимает сам, когда смог
  // его исполнить.
  const requestTextFocus = useCallback(() => setEditorFocus("text"), []);
  const handleEditorFocusHandled = useCallback(() => setEditorFocus(null), []);

  return {
    selectedNoteId,
    select,
    selectCreated,
    selectAfterDelete,
    editorFocus,
    requestTextFocus,
    handleEditorFocusHandled,
    mobilePane,
    showList,
  };
}
