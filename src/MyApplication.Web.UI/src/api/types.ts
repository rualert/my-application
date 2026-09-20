// Отражает DTO из MyApplication.Api/Models (System.Text.Json сериализует
// в camelCase по умолчанию). title == null — заметка без заголовка.

export interface NoteSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetails {
  id: string;
  title: string | null;
  text: string;
  // Версия заметки: её нужно вернуть в UpdateNoteRequest, чтобы сервер понял,
  // от какого состояния сделаны правки (см. docs/docs/notes/business-rules.md).
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Результат поиска приходит размеченным: отрезки идут подряд, склеив их text,
// получаем строку целиком, а отрезки с match — места совпадений с запросом
// (в том числе найденные с опечатками, которые клиент сам разметить не смог бы).
export interface HighlightedSegment {
  text: string;
  match: boolean;
}

export interface NoteSearchResult {
  id: string;
  // Пустой массив — заметка без заголовка.
  title: HighlightedSegment[];
  snippet: HighlightedSegment[];
}

export interface CreateNoteRequest {
  title: string | null;
  text: string;
}

export interface UpdateNoteRequest {
  title: string | null;
  text: string;
  version: number;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  userName: string;
}
