import { Group, Menu, Text, UnstyledButton } from "@mantine/core";
import { ChevronDown, LogOut } from "lucide-react";
import { NotesSearchBox } from "../notes/components/NotesSearchBox";
import { useAuth } from "./AuthProvider";

const APP_TITLE = "MyNotesApp";
const SEARCH_WIDTH = 420;

interface AppHeaderProps {
  onSelectNote: (id: string) => void;
}

/**
 * Шапка приложения: название слева, поиск по заметкам по центру, имя
 * пользователя с выпадающим меню (кнопка «Выйти») справа.
 */
export function AppHeader({ onSelectNote }: AppHeaderProps) {
  const { userName, logout } = useAuth();

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      px="md"
      py="xs"
      style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}
    >
      <Text fw={700}>{APP_TITLE}</Text>
      <div style={{ flex: 1, maxWidth: SEARCH_WIDTH }}>
        <NotesSearchBox onSelect={onSelectNote} />
      </div>
      <Menu position="bottom-end" withArrow>
        <Menu.Target>
          <UnstyledButton>
            <Group gap={4} wrap="nowrap">
              <Text size="sm">{userName}</Text>
              <ChevronDown size={16} />
            </Group>
          </UnstyledButton>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<LogOut size={16} />} onClick={() => void logout()}>
            Выйти
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  );
}
