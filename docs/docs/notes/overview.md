---
sidebar_position: 1
title: Обзор сценария
---

# Заметки — обзор

## Что это

Простое приложение для создания, просмотра, редактирования и удаления
заметок — заголовок и текст произвольного объёма (в пределах лимитов, см.
[правила](./business-rules)). Заметки хранятся в PostgreSQL.

## Где реализовано

| Слой | Компонент | Ответственность |
|---|---|---|
| Domain | `Note` | Сущность с инвариантами (лимиты title/text) |
| Domain | `NoteValidationException` | Нарушение бизнес-правил заметки |
| Application | `INoteService` / `NoteService` | Use case'ы: создать, получить список, получить по id, обновить, удалить |
| Application | `INoteRepository` | Порт для хранения заметок |
| Application | `NoteNotFoundException` | Заметка с указанным id не найдена |
| Infrastructure | `NotesDbContext`, `NoteRepository` | Реализация хранения через EF Core + PostgreSQL |
| Api (Presentation) | `NotesController` | REST-эндпоинты, см. [контракт API](./api-contract) |
| Web (Presentation) | `MyApplication.Web.UI` | React-интерфейс, см. [интерфейс](./web-ui) |

## Дальше

- [Правила формирования и хранения заметок](./business-rules)
- [Контракт API](./api-contract)
- [Интерфейс](./web-ui)

