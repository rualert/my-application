import { apiRequest } from "./client";
import type {
  CreateNoteRequest,
  NoteDetails,
  NoteSearchResult,
  NoteSummary,
  UpdateNoteRequest,
} from "./types";

const BASE_PATH = "/Notes";

export function listNotes(from: number, count: number, signal?: AbortSignal): Promise<NoteSummary[]> {
  return apiRequest(`${BASE_PATH}?from=${from}&count=${count}`, { signal });
}

export function searchNotes(query: string, signal?: AbortSignal): Promise<NoteSearchResult[]> {
  return apiRequest(`${BASE_PATH}/search?query=${encodeURIComponent(query)}`, { signal });
}

export function getNote(id: string, signal?: AbortSignal): Promise<NoteDetails> {
  return apiRequest(`${BASE_PATH}/${id}`, { signal });
}

export function createNote(request: CreateNoteRequest): Promise<NoteDetails> {
  return apiRequest(BASE_PATH, { method: "POST", body: JSON.stringify(request) });
}

export function updateNote(id: string, request: UpdateNoteRequest): Promise<NoteDetails> {
  return apiRequest(`${BASE_PATH}/${id}`, { method: "PUT", body: JSON.stringify(request) });
}

export function deleteNote(id: string): Promise<void> {
  return apiRequest(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
