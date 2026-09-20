import { ActionIcon, Alert, Button, Group, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { CloudDownload, CloudUpload, Eye, Pencil, TriangleAlert } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import type { NoteDetails } from "../../api/types";
import { isUntitled, UNTITLED_TITLE } from "../domain";
import { useNoteAutosave } from "../hooks/useNoteAutosave";
import { useNow } from "../hooks/useNow";
import type { EditorFocusTarget } from "../hooks/useNoteSelection";
import { formatSaveStatusText } from "../saveStatusText";

const STATUS_TICK_MS = 30_000;

export type EditorMode = "edit" | "view";

interface NoteEditorProps {
  note: NoteDetails;
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  // Просят поставить курсор в редактор: в заголовок (новая заметка) или в начало
  // текста (зафиксирован выбор в поиске). Просьба живёт выше, потому что может прийти
  // раньше, чем заметка загрузилась и этот редактор появился; исполнив её (или сочтя
  // неисполнимой), редактор её снимает.
  focusTarget: EditorFocusTarget | null;
  onFocusHandled: () => void;
}

// Монтируется заново для каждой заметки (key={note.id} в NoteEditorPanel):
// черновик и автосохранение живут ровно столько, сколько открыта эта заметка,
// а при закрытии хук досохраняет несохранённое (см. useNoteAutosave).
export function NoteEditor({ note, mode, onModeChange, focusTarget, onFocusHandled }: NoteEditorProps) {
  const autosave = useNoteAutosave(note);
  const now = useNow(STATUS_TICK_MS);
  const untitled = isUntitled(autosave.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Курсор — в конец заголовка (новая заметка) или в начало текста (docs/docs/notes/web-ui.md,
  // «Выбор результата»). В режиме просмотра полей нет, ставить курсор некуда — просьбу
  // всё равно снимаем, чтобы она не «дожила» до момента, когда пользователь сам переключит
  // режим. (Для заголовка режим переключает NoteEditorPanel ещё до этого эффекта.)
  useEffect(() => {
    if (!focusTarget) {
      return;
    }
    if (mode === "edit") {
      if (focusTarget === "title") {
        const titleInput = titleInputRef.current;
        titleInput?.focus();
        titleInput?.setSelectionRange(titleInput.value.length, titleInput.value.length);
      } else {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(0, 0);
      }
    }
    onFocusHandled();
  }, [focusTarget, mode, onFocusHandled]);

  // Enter или стрелка вниз в заголовке — курсор в начало текста; стрелка вверх
  // из начала текста — курсор в конец заголовка. Делает переход между полями
  // плавным, как между строками одного документа.
  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== "ArrowDown") {
      return;
    }
    event.preventDefault();
    textareaRef.current?.focus();
    textareaRef.current?.setSelectionRange(0, 0);
  };

  const handleTextKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if (event.key !== "ArrowUp" || textarea.selectionStart !== 0 || textarea.selectionEnd !== 0) {
      return;
    }
    event.preventDefault();
    const titleInput = titleInputRef.current;
    if (!titleInput) {
      return;
    }
    titleInput.focus();
    titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
  };

  const statusText = formatSaveStatusText(autosave.status, autosave.lastSavedAt, now);

  return (
    <Stack h="100%" gap={0}>
      <Group justify="flex-end" p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Tooltip label={mode === "edit" ? "Просмотр" : "Редактирование"}>
          <ActionIcon
            aria-label={mode === "edit" ? "Просмотр" : "Редактирование"}
            variant="subtle"
            onClick={() => onModeChange(mode === "edit" ? "view" : "edit")}
          >
            {mode === "edit" ? <Eye size={18} /> : <Pencil size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      {autosave.hasConflict && (
        // Заметку изменили в другом месте, наше сохранение отклонено. Ничего
        // не решаем за пользователя: напечатанное остаётся на экране, пока он
        // не выберет, чей вариант оставить (docs/docs/notes/web-ui.md).
        // Предупреждение — вне прокручиваемой области ниже: внутри неё у длинной
        // заметки оно уезжает за верхний край, и пользователь просто не видит,
        // почему заметка перестала сохраняться. flexShrink: 0 — чтобы его не
        // сжала растущая область текста.
        <Alert
          color="yellow"
          icon={<TriangleAlert size={18} />}
          title="Заметка изменена в другом месте"
          m="md"
          mb={0}
          style={{ flexShrink: 0 }}
        >
          <Stack gap="xs" align="flex-start">
            <Text size="sm">
              Её отредактировали в другой вкладке или на другом устройстве, поэтому изменения не сохраняются. Выберите,
              какой вариант оставить.
            </Text>
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                leftSection={<CloudDownload size={16} />}
                onClick={autosave.reloadFromServer}
              >
                Загрузить актуальную
              </Button>
              <Button
                size="xs"
                variant="default"
                leftSection={<CloudUpload size={16} />}
                onClick={autosave.overwriteWithMine}
              >
                Перезаписать моей
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      <Stack style={{ flex: 1, overflow: "auto" }} p="md" gap="sm">
        {mode === "edit" ? (
          <>
            <TextInput
              ref={titleInputRef}
              value={autosave.title}
              onChange={(event) => autosave.setTitle(event.currentTarget.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={autosave.flush}
              placeholder={UNTITLED_TITLE}
              variant="unstyled"
              styles={{ input: { fontWeight: 700, fontSize: "1.5rem" } }}
            />
            <Textarea
              ref={textareaRef}
              value={autosave.text}
              onChange={(event) => autosave.setText(event.currentTarget.value)}
              onKeyDown={handleTextKeyDown}
              onBlur={autosave.flush}
              variant="unstyled"
              autosize
              minRows={12}
              styles={{ root: { flex: 1 } }}
            />
          </>
        ) : (
          <>
            <Title order={2} c={untitled ? "dimmed" : undefined}>
              {untitled ? UNTITLED_TITLE : autosave.title}
            </Title>
            <ReactMarkdown>{autosave.text}</ReactMarkdown>
          </>
        )}
      </Stack>

      <Group justify="flex-end" p="xs" style={{ borderTop: "1px solid var(--mantine-color-gray-3)" }}>
        <Text size="sm" c={autosave.error ? "red" : "dimmed"}>
          {autosave.error ? `Ошибка сохранения: ${autosave.error}` : statusText}
        </Text>
      </Group>
    </Stack>
  );
}
