import { ActionIcon, Button, Group, Loader, Modal, NavLink, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { PanelLeftClose, PanelLeftOpen, Plus, RotateCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isUntitled, UNTITLED_TITLE } from "../domain";
import { useCreateNote } from "../hooks/useCreateNote";
import { useDeleteNote } from "../hooks/useDeleteNote";
import { useHotkey } from "../hooks/useHotkey";
import { useNotesList } from "../hooks/useNotesList";

const SCROLL_LOAD_THRESHOLD_PX = 200;

interface NotesListPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedNoteId: string | null;
  onSelect: (id: string | null) => void;
  onCreated: (id: string) => void;
  // Enter в списке: курсор — в текст открытой заметки (как фиксация выбора в поиске).
  onCommit: () => void;
  // Счётчик просьб «верни фокус в список» (Esc из редактора): растёт на каждую просьбу.
  focusRequest: number;
}

export function NotesListPanel({
  collapsed,
  onToggleCollapse,
  selectedNoteId,
  onSelect,
  onCreated,
  onCommit,
  focusRequest,
}: NotesListPanelProps) {
  const notesQuery = useNotesList();
  const createMutation = useCreateNote();
  const deleteMutation = useDeleteNote();
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Куда вернуть фокус, когда окно подтверждения закроется (см. closeConfirm).
  const [focusAfterConfirm, setFocusAfterConfirm] = useState<{ noteId: string | null } | null>(null);

  const notes = notesQuery.data?.pages.flatMap((page) => page) ?? [];
  const selectedIndex = notes.findIndex((note) => note.id === selectedNoteId);
  const selectedNote = selectedIndex === -1 ? null : notes[selectedIndex];

  // Фокус внутри списка ходит по самим строкам (roving tabindex): Tab приводит на
  // выбранную заметку, дальше по списку двигают стрелки.
  const focusNote = (id: string | null) => {
    const list = listRef.current;
    const selector = id === null ? "[data-note-id]" : `[data-note-id="${id}"]`;
    list?.querySelector<HTMLElement>(selector)?.focus();
  };

  const handleCreate = () => {
    createMutation.mutate(
      { title: null, text: "" },
      { onSuccess: (created) => onCreated(created.id) },
    );
  };

  // Alt+N работает и когда список свёрнут: созданная заметка всё равно открывается
  // в редакторе, а курсор встаёт в её заголовок.
  useHotkey({ code: "KeyN", alt: true }, handleCreate);

  // Esc из редактора: фокус — на выбранной заметке (или на первой, если выбора нет).
  // Зависимость только от счётчика: важна сама просьба, а не текущий выбор.
  useEffect(() => {
    if (focusRequest === 0) {
      return;
    }
    focusNote(selectedNoteId);
  }, [focusRequest]);

  // Фокус после окна подтверждения возвращаем сами (returnFocus={false} у Modal):
  // удалённой строки, на которую Mantine вернул бы его, больше нет, да и делает он
  // это с задержкой — и перебил бы наш.
  useEffect(() => {
    if (!focusAfterConfirm) {
      return;
    }
    focusNote(focusAfterConfirm.noteId);
    setFocusAfterConfirm(null);
  }, [focusAfterConfirm]);

  const closeConfirm = (focusNoteId: string | null) => {
    setConfirmingDelete(false);
    setFocusAfterConfirm({ noteId: focusNoteId });
  };

  const handleConfirmDelete = () => {
    if (!selectedNote) {
      return;
    }
    // После удаления открываем соседнюю заметку: следующую, а если удалена
    // последняя — предыдущую (docs/docs/notes/web-ui.md, «Удаление заметки»).
    const neighbour = notes[selectedIndex + 1] ?? notes[selectedIndex - 1] ?? null;
    deleteMutation.mutate(selectedNote.id, {
      onSuccess: () => {
        onSelect(neighbour?.id ?? null);
        closeConfirm(neighbour?.id ?? null);
      },
    });
  };

  const handleScrollPositionChange = () => {
    const viewport = viewportRef.current;
    if (!viewport || !notesQuery.hasNextPage || notesQuery.isFetchingNextPage) {
      return;
    }
    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (distanceToBottom < SCROLL_LOAD_THRESHOLD_PX) {
      notesQuery.fetchNextPage();
    }
  };

  // Стрелки двигают выбор по списку и сразу открывают заметку — то же, что нажатие
  // на неё мышью. Enter уводит курсор в её текст, Delete спрашивает про удаление.
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex =
        event.key === "ArrowDown"
          ? selectedIndex + 1
          : selectedIndex === -1
            ? notes.length - 1
            : selectedIndex - 1;
      // Дошли до конца загруженного — подтягиваем следующую страницу: стрелками
      // до низа списка доезжают, не прокручивая его мышью.
      if (nextIndex >= notes.length && notesQuery.hasNextPage && !notesQuery.isFetchingNextPage) {
        notesQuery.fetchNextPage();
      }
      const next = notes[nextIndex];
      if (next) {
        onSelect(next.id);
        focusNote(next.id);
      }
      return;
    }
    if (event.key === "Enter" && selectedNoteId) {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === "Delete" && selectedNoteId) {
      event.preventDefault();
      setConfirmingDelete(true);
    }
  };

  const confirmModal = (
    <Modal
      opened={confirmingDelete}
      onClose={() => closeConfirm(selectedNoteId)}
      title="Удалить заметку?"
      returnFocus={false}
      centered
    >
      <Stack gap="md">
        <Text size="sm">
          Заметка «{selectedNote && !isUntitled(selectedNote.title) ? selectedNote.title : UNTITLED_TITLE}» будет
          удалена безвозвратно.
        </Text>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={() => closeConfirm(selectedNoteId)}>
            Отмена
          </Button>
          {/* Фокус по умолчанию здесь: подтвердить удаление можно одним Enter. */}
          <Button color="red" data-autofocus loading={deleteMutation.isPending} onClick={handleConfirmDelete}>
            Удалить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  if (collapsed) {
    return (
      <Stack align="center" p="xs" h="100%">
        <Tooltip label="Показать список заметок" position="right">
          <ActionIcon aria-label="Показать список заметок" variant="subtle" onClick={onToggleCollapse}>
            <PanelLeftOpen size={18} />
          </ActionIcon>
        </Tooltip>
        {confirmModal}
      </Stack>
    );
  }

  // Tab должен приводить в список, даже когда заметка не выбрана или выбранной нет
  // среди загруженных: тогда «своей» строкой становится первая.
  const focusableNoteId = selectedNote?.id ?? notes[0]?.id ?? null;

  return (
    <Stack h="100%" gap={0}>
      <Group
        gap="xs"
        p="xs"
        wrap="nowrap"
        style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
      >
        <Tooltip label="Свернуть список">
          <ActionIcon aria-label="Свернуть список" variant="subtle" onClick={onToggleCollapse}>
            <PanelLeftClose size={18} />
          </ActionIcon>
        </Tooltip>
        <div style={{ flex: 1 }} />
        <Tooltip label="Обновить список">
          <ActionIcon
            aria-label="Обновить список"
            variant="subtle"
            loading={notesQuery.isRefetching}
            onClick={() => notesQuery.refetch()}
          >
            <RotateCw size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Добавить заметку">
          <ActionIcon
            aria-label="Добавить заметку"
            variant="subtle"
            loading={createMutation.isPending}
            onClick={handleCreate}
          >
            <Plus size={18} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Удалить выбранную">
          <ActionIcon
            aria-label="Удалить выбранную"
            variant="subtle"
            color="red"
            disabled={!selectedNoteId}
            onClick={() => setConfirmingDelete(true)}
          >
            <Trash2 size={18} />
          </ActionIcon>
        </Tooltip>
      </Group>

      {notesQuery.isLoading ? (
        <Stack align="center" justify="center" style={{ flex: 1 }}>
          <Loader size="sm" />
        </Stack>
      ) : notesQuery.isError ? (
        <Stack align="center" justify="center" p="md" style={{ flex: 1 }}>
          <Text c="red" size="sm">
            Не удалось загрузить список заметок
          </Text>
        </Stack>
      ) : (
        <ScrollArea style={{ flex: 1 }} viewportRef={viewportRef} onScrollPositionChange={handleScrollPositionChange}>
          <Stack gap={0} ref={listRef} role="listbox" aria-label="Заметки" onKeyDown={handleListKeyDown}>
            {notes.map((note) => (
              <NavLink
                key={note.id}
                data-note-id={note.id}
                role="option"
                aria-selected={note.id === selectedNoteId}
                tabIndex={note.id === focusableNoteId ? 0 : -1}
                label={
                  isUntitled(note.title) ? (
                    <Text span inherit c="dimmed">
                      {UNTITLED_TITLE}
                    </Text>
                  ) : (
                    note.title
                  )
                }
                active={note.id === selectedNoteId}
                onClick={() => onSelect(note.id)}
              />
            ))}
            {notesQuery.isFetchingNextPage && (
              <Stack align="center" p="sm">
                <Loader size="xs" />
              </Stack>
            )}
          </Stack>
        </ScrollArea>
      )}

      {confirmModal}
    </Stack>
  );
}
