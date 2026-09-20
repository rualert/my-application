import { Loader, Stack, Text } from "@mantine/core";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useHotkey } from "../hooks/useHotkey";
import { useNote } from "../hooks/useNote";
import type { EditorFocusTarget } from "../hooks/useNoteSelection";
import { NoteEditor, type EditorMode } from "./NoteEditor";

interface NoteEditorPanelProps {
  noteId: string | null;
  // Просьба поставить курсор в редактор — см. NoteEditor. Пока заметка грузится,
  // она просто ждёт: редактора ещё нет, а исполнит её тот, что появится.
  editorFocus?: EditorFocusTarget | null;
  onEditorFocusHandled?: () => void;
  // Esc: уйти из редактора обратно в список заметок.
  onLeaveToList?: () => void;
}

const noop = () => {};

export function NoteEditorPanel({
  noteId,
  editorFocus = null,
  onEditorFocusHandled = noop,
  onLeaveToList = noop,
}: NoteEditorPanelProps) {
  const noteQuery = useNote(noteId);
  // Режим живёт здесь, а не в NoteEditor: тот перемонтируется на каждую заметку,
  // а выбранный режим (правка/просмотр) при переключении заметок сохраняется.
  const [mode, setMode] = useState<EditorMode>("edit");
  // Своя просьба поставить курсор — от переключения режима отсюда. Внешняя (новая
  // заметка, выбор в поиске) важнее: она про то, какую заметку вообще открыли.
  const [localFocus, setLocalFocus] = useState<EditorFocusTarget | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Заголовка в режиме просмотра нет, а пустую новую заметку смотреть незачем, — так что
  // просьба поставить курсор в заголовок сама переводит в режим редактирования. Именно
  // при рендере, а не эффектом: созданная заметка уже в кэше, редактор монтируется в этом
  // же проходе, и его эффект успел бы счесть просьбу неисполнимой и снять её.
  if (editorFocus === "title" && mode === "view") {
    setMode("edit");
  }

  // Переключение режима не должно терять фокус: иначе после Ctrl+E курсор оказывается
  // на <body>, и ни Esc, ни прокрутка с клавиатуры уже не работают.
  const changeMode = (next: EditorMode) => {
    if (!noteId) {
      return;
    }
    setMode(next);
    if (next === "view") {
      // В режиме просмотра полей нет — фокус берёт на себя сама область просмотра.
      panelRef.current?.focus();
    } else {
      setLocalFocus("text");
    }
  };

  useHotkey({ code: "KeyE", mod: true }, () => changeMode(mode === "edit" ? "view" : "edit"));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") {
      return;
    }
    event.preventDefault();
    onLeaveToList();
  };

  const handleFocusHandled = () => {
    setLocalFocus(null);
    onEditorFocusHandled();
  };

  let content: ReactNode;
  if (!noteId) {
    content = (
      <Stack align="center" justify="center" h="100%" p="md">
        <Text c="dimmed">Выберите заметку слева или создайте новую</Text>
      </Stack>
    );
  } else if (noteQuery.isLoading) {
    content = (
      <Stack align="center" justify="center" h="100%">
        <Loader size="sm" />
      </Stack>
    );
  } else if (noteQuery.isError || !noteQuery.data) {
    content = (
      <Stack align="center" justify="center" h="100%" p="md">
        <Text c="red">Не удалось загрузить заметку</Text>
      </Stack>
    );
  } else {
    content = (
      <NoteEditor
        key={noteQuery.data.id}
        note={noteQuery.data}
        mode={mode}
        onModeChange={changeMode}
        focusTarget={editorFocus ?? localFocus}
        onFocusHandled={handleFocusHandled}
      />
    );
  }

  // tabIndex={-1}: мышью сюда не встают, но фокус можно поставить из кода — и тогда
  // Esc, нажатый в режиме просмотра, тоже доходит до этого обработчика.
  return (
    <div ref={panelRef} tabIndex={-1} onKeyDown={handleKeyDown} style={{ height: "100%", outline: "none" }}>
      {content}
    </div>
  );
}
