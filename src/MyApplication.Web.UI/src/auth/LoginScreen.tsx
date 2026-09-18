import { Paper, Stack, Text, ThemeIcon } from "@mantine/core";
import { Bookmark, FileText, NotebookPen, NotebookText, PenLine, StickyNote } from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import { GoogleLoginButton } from "./GoogleLoginButton";

const APP_TITLE = "MyNotesApp";

interface DecorativeIcon {
  Icon: ComponentType<{ size?: number; style?: CSSProperties }>;
  size: number;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  rotate: number;
}

// Абстрактный фон вместо картинки-файла: несколько крупных полупрозрачных
// иконок из lucide-react (та же библиотека, что уже используется в приложении)
// вперемешку с линиями «линованной бумаги» — без внешних ассетов и без
// вопроса лицензирования, легко переживает смену темы.
const DECORATIVE_ICONS: DecorativeIcon[] = [
  { Icon: NotebookText, size: 220, top: "-4rem", left: "-3rem", rotate: -18 },
  { Icon: StickyNote, size: 140, top: "8%", right: "8%", rotate: 12 },
  { Icon: PenLine, size: 120, bottom: "12%", left: "6%", rotate: -8 },
  { Icon: FileText, size: 160, bottom: "-3rem", right: "-2rem", rotate: 15 },
  { Icon: Bookmark, size: 90, top: "38%", right: "18%", rotate: -6 },
];

export function LoginScreen() {
  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, var(--mantine-color-violet-1), var(--mantine-color-blue-0) 55%, var(--mantine-color-teal-0))",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "repeating-linear-gradient(var(--mantine-color-violet-3) 0 1px, transparent 1px 2.75rem)",
          opacity: 0.35,
        }}
      />

      {DECORATIVE_ICONS.map(({ Icon, size, rotate, ...position }, index) => (
        <Icon
          key={index}
          size={size}
          style={{
            position: "absolute",
            color: "var(--mantine-color-violet-5)",
            opacity: 0.18,
            transform: `rotate(${rotate}deg)`,
            ...position,
          }}
        />
      ))}

      <Paper
        radius="lg"
        shadow="xl"
        p="xl"
        style={{ position: "relative", width: "min(90vw, 22rem)", textAlign: "center" }}
      >
        <Stack align="center" gap="md">
          <ThemeIcon size={56} radius="xl" variant="light" color="violet">
            <NotebookPen size={30} />
          </ThemeIcon>

          <Stack align="center" gap={4}>
            <Text fw={700} size="xl">
              {APP_TITLE}
            </Text>
            <Text c="dimmed" size="sm">
              Ваши заметки — всегда под рукой
            </Text>
          </Stack>

          <GoogleLoginButton />
        </Stack>
      </Paper>
    </div>
  );
}
