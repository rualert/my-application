import { Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useIsMobile } from "../hooks/useIsMobile";
import { NotesSearchBox } from "../notes/components/NotesSearchBox";
import { useAuth } from "./AuthProvider";

const APP_TITLE = "MyNotesApp";
const SEARCH_WIDTH = 420;

interface AppHeaderProps {
  // Что делает поиск с выбранной заметкой — см. NotesSearchBox.
  openNoteId: string | null;
  onPreviewNote: (id: string) => void;
  onCommitNote: () => void;
}

/**
 * Шапка приложения: название слева, поиск по заметкам по центру, имя
 * пользователя с выпадающим меню (кнопка «Выйти») справа.
 *
 * На телефоне названия нет, а имя пользователя заменяет значок: всё место в
 * строке отдано полю поиска (docs/docs/notes/web-ui.md, «Интерфейс для телефона»).
 */
export function AppHeader({ openNoteId, onPreviewNote, onCommitNote }: AppHeaderProps) {
  const { userName, logout } = useAuth();
  const isMobile = useIsMobile();

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px={isMobile ? "xs" : "md"}
      py="xs"
      style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
    >
      {!isMobile && <Text fw={700}>{APP_TITLE}</Text>}
      <div style={{ flex: 1, maxWidth: isMobile ? undefined : SEARCH_WIDTH, minWidth: 0 }}>
        <NotesSearchBox openNoteId={openNoteId} onPreview={onPreviewNote} onCommit={onCommitNote} />
      </div>
      <Menu position="bottom-end" withArrow>
        <Menu.Target>
          {/* На широком экране доступное имя кнопки — сама надпись с именем
              пользователя; на телефоне надписи нет, поэтому оно задаётся явно. */}
          <UnstyledButton aria-label={isMobile ? "Меню пользователя" : undefined}>
            {isMobile ? (
              <UserRound size={22} />
            ) : (
              <Group gap={4} wrap="nowrap">
                <Text size="sm">{userName}</Text>
                <ChevronDown size={16} />
              </Group>
            )}
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          {/* На телефоне имени в шапке не видно — показываем его хотя бы здесь. */}
          {isMobile && <Menu.Label>{userName}</Menu.Label>}
          <Menu.Item leftSection={<LogOut size={16} />} onClick={() => void logout()}>
            Выйти
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
