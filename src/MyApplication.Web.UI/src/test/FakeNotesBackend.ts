import { http, HttpResponse } from "msw";
import type { NoteDetails, UpdateNoteRequest } from "../api/types";

export interface RecordedUpdate {
  id: string;
  request: UpdateNoteRequest;
}

// Заменяет бэкенд /Notes на уровне HTTP (MSW): хранит заметки в памяти,
// запоминает пришедшие PUT и умеет удерживать/ронять ответы на них — так тесты
// управляют "запросом в полёте" и ошибками, не трогая клиентский код.
export class FakeNotesBackend {
  readonly updates: RecordedUpdate[] = [];

  private readonly notes = new Map<string, NoteDetails>();
  private updateGate: Promise<void> | null = null;
  private updateFailure: { status: number; message: string } | null = null;
  private updateCounter = 0;

  addNote(note: Partial<NoteDetails> & { id: string }): NoteDetails {
    const created: NoteDetails = {
      title: null,
      text: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...note,
    };
    this.notes.set(created.id, created);
    return created;
  }

  // Ответы на PUT не уходят, пока не вызвана возвращённая функция. Сам запрос
  // при этом уже зарегистрирован в updates — то есть он "в полёте".
  holdUpdates(): () => void {
    let release!: () => void;
    this.updateGate = new Promise<void>((resolve) => {
      release = () => {
        this.updateGate = null;
        resolve();
      };
    });
    return release;
  }

  failUpdates(status: number, message: string): void {
    this.updateFailure = { status, message };
  }

  readonly handlers = [
    http.get("/Notes/:id", ({ params }) => {
      const note = this.notes.get(params.id as string);
      return note ? HttpResponse.json(note) : new HttpResponse("Заметка не найдена", { status: 400 });
    }),

    http.put("/Notes/:id", async ({ params, request }) => {
      const id = params.id as string;
      const body = (await request.json()) as UpdateNoteRequest;
      this.updates.push({ id, request: body });

      await this.updateGate;

      if (this.updateFailure) {
        return new HttpResponse(this.updateFailure.message, { status: this.updateFailure.status });
      }

      const existing = this.notes.get(id);
      if (!existing) {
        return new HttpResponse("Заметка не найдена", { status: 400 });
      }
      this.updateCounter += 1;
      const updated: NoteDetails = {
        ...existing,
        title: body.title,
        text: body.text,
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, this.updateCounter)).toISOString(),
      };
      this.notes.set(id, updated);
      return HttpResponse.json(updated);
    }),
  ];
}
