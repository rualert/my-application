import { ActionIcon, Group, Loader, Stack, Text, Textarea, TextInput, Title, Tooltip } from "@mantine/core";
import { Eye, Pencil } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { isUntitled, UNTITLED_TITLE } from "../domain";
import { useNote } from "../hooks/useNote";
import { useNoteAutosave } from "../hooks/useNoteAutosave";
import { useNow } from "../hooks/useNow";
import { formatSaveStatusText } from "../saveStatusText";

const STATUS_TICK_MS = 30_000;

interface NoteEditorPanelProps {
  noteId: string | null;
}

export function NoteEditorPanel({ noteId }: NoteEditorPanelProps) {
  const noteQuery = useNote(noteId);
  const autosave = useNoteAutosave(noteQuery.data);
  const [mode, setMode] = useState<"edit" | "view">("edit");
  const now = useNow(STATUS_TICK_MS);
  const untitled = isUntitled(autosave.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const statusText = formatSaveStatusText(autosave.status, autosave.lastSavedAt, now);

  return (
    <Stack h="100%" gap={0}>
      <Group justify="flex-end" p="xs" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
        <Tooltip label={mode === "edit" ? "Просмотр" : "Редактирование"}>
          <ActionIcon
            aria-label={mode === "edit" ? "Просмотр" : "Редактирование"}
            variant="subtle"
            onClick={() => setMode(mode === "edit" ? "view" : "edit")}
          >
            {mode === "edit" ? <Eye size={18} /> : <Pencil size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      <Stack style={{ flex: 1, overflow: "auto" }} p="md" gap="sm">
        {mode === "edit" ? (
          <>
            <TextInput
              ref={titleInputRef}
              value={autosave.title}
              onChange={(event) => autosave.setTitle(event.currentTarget.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder={UNTITLED_TITLE}
              variant="unstyled"
              styles={{ input: { fontWeight: 700, fontSize: "1.5rem" } }}
            />
            <Textarea
              ref={textareaRef}
              value={autosave.text}
              onChange={(event) => autosave.setText(event.currentTarget.value)}
              onKeyDown={handleTextKeyDown}
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
