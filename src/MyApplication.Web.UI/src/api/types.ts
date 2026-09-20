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
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string | null;
  text: string;
}

export interface UpdateNoteRequest {
  title: string | null;
  text: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  userName: string;
}
