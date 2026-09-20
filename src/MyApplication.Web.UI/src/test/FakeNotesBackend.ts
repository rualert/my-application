import { http, HttpResponse } from "msw";
import type { NoteDetails, NoteSearchResult, UpdateNoteRequest } from "../api/types";

export interface RecordedUpdate {
  id: string;
  request: UpdateNoteRequest;
}

// Заменяет бэкенд /Notes на уровне HTTP (MSW): хранит заметки в памяти,
// запоминает пришедшие PUT и умеет удерживать/ронять ответы на них — так тесты
// управляют "запросом в полёте" и ошибками, не трогая клиентский код.
export class FakeNotesBackend {
  readonly updates: RecordedUpdate[] = [];
  // Каждый дошедший до сервера поисковый запрос — по ним видно, ушёл ли запрос вообще.
  readonly searchQueries: string[] = [];

  private readonly notes = new Map<string, NoteDetails>();
  private updateGate: Promise<void> | null = null;
  private updateFailure: { status: number; message: string } | null = null;
  private updateCounter = 0;
  private searchResults: NoteSearchResult[] = [];
  private searchFailure: { status: number; message: string } | null = null;

  addNote(note: Partial<NoteDetails> & { id: string }): NoteDetails {
    const created: NoteDetails = {
      title: null,
      text: "",
      version: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...note,
    };
    this.notes.set(created.id, created);
    return created;
  }

  // Правка «из другой вкладки»: меняет заметку мимо клиента и поднимает её
  // версию, после чего сохранение клиента со старой версией получит 409.
  editElsewhere(id: string, changes: Partial<Pick<NoteDetails, "title" | "text">>): NoteDetails {
    const existing = this.notes.get(id);
    if (!existing) {
      throw new Error(`Заметка ${id} не заведена в FakeNotesBackend`);
    }
    const updated: NoteDetails = { ...existing, ...changes, version: existing.version + 1 };
    this.notes.set(id, updated);
    return updated;
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

  // Что вернёт поиск на любой запрос: размечает совпадения сервер, поэтому
  // тесту достаточно задать готовую выдачу.
  setSearchResults(results: NoteSearchResult[]): void {
    this.searchResults = results;
  }

  failSearch(status: number, message: string): void {
    this.searchFailure = { status, message };
  }

  readonly handlers = [
    // Раньше /Notes/:id — иначе тот перехватил бы /Notes/search как заметку с id "search".
    http.get("/Notes/search", ({ request }) => {
      this.searchQueries.push(new URL(request.url).searchParams.get("query") ?? "");

      if (this.searchFailure) {
        return new HttpResponse(this.searchFailure.message, { status: this.searchFailure.status });
      }

      return HttpResponse.json(this.searchResults);
    }),

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
      // Та же проверка версии, что на сервере (docs/docs/notes/api-contract.md).
      if (body.version !== existing.version) {
        return new HttpResponse("Заметка была изменена", { status: 409 });
      }
      this.updateCounter += 1;
      const updated: NoteDetails = {
        ...existing,
        title: body.title,
        text: body.text,
        version: existing.version + 1,
        updatedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, this.updateCounter)).toISOString(),
      };
      this.notes.set(id, updated);
      return HttpResponse.json(updated);
    }),
  ];
}
