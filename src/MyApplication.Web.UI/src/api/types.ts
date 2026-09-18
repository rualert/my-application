// Отражает DTO из MyApplication.Api/Models (System.Text.Json сериализует
// в camelCase по умолчанию).

export interface NoteSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteDetails {
  id: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequest {
  title: string;
  text: string;
}

export interface UpdateNoteRequest {
  title: string;
  text: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
}
