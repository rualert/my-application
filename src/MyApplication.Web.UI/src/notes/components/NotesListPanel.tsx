import { ActionIcon, Group, Loader, NavLink, ScrollArea, Stack, Text, Tooltip } from "@mantine/core";
import { PanelLeftClose, PanelLeftOpen, Plus, RotateCw, Trash2 } from "lucide-react";
import { useRef } from "react";
import { isUntitled, UNTITLED_TITLE } from "../domain";
import { useCreateNote } from "../hooks/useCreateNote";
import { useDeleteNote } from "../hooks/useDeleteNote";
import { useNotesList } from "../hooks/useNotesList";

const SCROLL_LOAD_THRESHOLD_PX = 200;

interface NotesListPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedNoteId: string | null;
  onSelect: (id: string | null) => void;
  onCreated: (id: string) => void;
}

export function NotesListPanel({ collapsed, onToggleCollapse, selectedNoteId, onSelect, onCreated }: NotesListPanelProps) {
  const notesQuery = useNotesList();
  const createMutation = useCreateNote();
  const deleteMutation = useDeleteNote();
  const viewportRef = useRef<HTMLDivElement>(null);

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

  const handleCreate = () => {
    createMutation.mutate(
      { title: null, text: "" },
      { onSuccess: (created) => onCreated(created.id) },
    );
  };

  const handleDelete = () => {
    if (!selectedNoteId) {
      return;
    }
    deleteMutation.mutate(selectedNoteId, { onSuccess: () => onSelect(null) });
  };

  if (collapsed) {
    return (
      <Stack align="center" p="xs" h="100%">
        <Tooltip label="Показать список заметок" position="right">
          <ActionIcon aria-label="Показать список заметок" variant="subtle" onClick={onToggleCollapse}>
            <PanelLeftOpen size={18} />
          </ActionIcon>
        </Tooltip>
      </Stack>
    );
  }

  const notes = notesQuery.data?.pages.flatMap((page) => page) ?? [];

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
            loading={deleteMutation.isPending}
            onClick={handleDelete}
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
          <Stack gap={0}>
            {notes.map((note) => (
              <NavLink
                key={note.id}
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
    </Stack>
  );
}
