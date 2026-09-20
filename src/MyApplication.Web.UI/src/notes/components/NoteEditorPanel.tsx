import { ActionIcon, Group, Loader, Stack, Text, Tooltip } from "@mantine/core";
import { ArrowLeft, Eye, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useIsMobile } from "../../hooks/useIsMobile";
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
  // Телефон: кнопка «Назад» к списку заметок.
  onBack?: () => void;
  // Телефон: кнопка удаления открытой заметки. Подтверждение спрашивает и удаляет
  // не эта панель, а список — соседи удаляемой заметки известны только ему.
  onRequestDelete?: () => void;
}

const noop = () => {};

export function NoteEditorPanel({
  noteId,
  editorFocus = null,
  onEditorFocusHandled = noop,
  onLeaveToList = noop,
  onBack = noop,
  onRequestDelete = noop,
}: NoteEditorPanelProps) {
  const isMobile = useIsMobile();
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
        focusTarget={editorFocus ?? localFocus}
        onFocusHandled={handleFocusHandled}
      />
    );
  }

  // Тулбар живёт здесь, а не в NoteEditor: на телефоне в нём кнопка «Назад», а она нужна
  // и пока заметка грузится, и когда загрузить её не удалось, — то есть когда редактора
  // нет. Пока заметка не выбрана, тулбара нет вовсе: на телефоне такой экран не
  // показывается, а на ПК показывать пустую полоску незачем.
  const toolbar = noteId !== null && (
    <Group justify="space-between" wrap="nowrap" p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
      {isMobile ? (
        <Tooltip label="Назад к списку">
          <ActionIcon aria-label="Назад к списку" variant="subtle" size="lg" onClick={onBack}>
            <ArrowLeft size={18} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <div />
      )}
      <Group gap="xs" wrap="nowrap">
        {isMobile && (
          <Tooltip label="Удалить заметку">
            <ActionIcon aria-label="Удалить заметку" variant="subtle" color="red" size="lg" onClick={onRequestDelete}>
              <Trash2 size={18} />
            </ActionIcon>
          </Tooltip>
        )}
        <Tooltip label={mode === "edit" ? "Просмотр" : "Редактирование"}>
          <ActionIcon
            aria-label={mode === "edit" ? "Просмотр" : "Редактирование"}
            variant="subtle"
            size={isMobile ? "lg" : "md"}
            onClick={() => changeMode(mode === "edit" ? "view" : "edit")}
          >
            {mode === "edit" ? <Eye size={18} /> : <Pencil size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );

  // tabIndex={-1}: мышью сюда не встают, но фокус можно поставить из кода — и тогда
  // Esc, нажатый в режиме просмотра, тоже доходит до этого обработчика.
  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{ height: "100%", outline: "none", display: "flex", flexDirection: "column" }}
    >
      {toolbar}
      <div style={{ flex: 1, minHeight: 0 }}>{content}</div>
    </div>
  );
}
