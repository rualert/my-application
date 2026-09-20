import { Loader, Stack, Text } from "@mantine/core";
import { useState } from "react";
import { useNote } from "../hooks/useNote";
import { NoteEditor, type EditorMode } from "./NoteEditor";

interface NoteEditorPanelProps {
  noteId: string | null;
  // Просьба поставить курсор в редактор — см. NoteEditor. Пока заметка грузится,
  // флаг просто ждёт: редактора ещё нет, а исполнит его тот, что появится.
  editorFocusRequested?: boolean;
  onEditorFocusHandled?: () => void;
}

const noop = () => {};

export function NoteEditorPanel({ noteId, editorFocusRequested = false, onEditorFocusHandled = noop }: NoteEditorPanelProps) {
  const noteQuery = useNote(noteId);
  // Режим живёт здесь, а не в NoteEditor: тот перемонтируется на каждую заметку,
  // а выбранный режим (правка/просмотр) при переключении заметок сохраняется.
  const [mode, setMode] = useState<EditorMode>("edit");

  if (!noteId) {
    return (
      <Stack align="center" justify="center" h="100%" p="md">
        <Text c="dimmed">Выберите заметку слева или создайте новую</Text>
      </Stack>
    );
  }

  if (noteQuery.isLoading) {
    return (
      <Stack align="center" justify="center" h="100%">
        <Loader size="sm" />
      </Stack>
    );
  }

  if (noteQuery.isError || !noteQuery.data) {
    return (
      <Stack align="center" justify="center" h="100%" p="md">
        <Text c="red">Не удалось загрузить заметку</Text>
      </Stack>
    );
  }

  return (
    <NoteEditor
      key={noteQuery.data.id}
      note={noteQuery.data}
      mode={mode}
      onModeChange={setMode}
      focusRequested={editorFocusRequested}
      onFocusHandled={onEditorFocusHandled}
    />
  );
}
