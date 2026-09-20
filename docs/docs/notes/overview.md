---
sidebar_position: 1
title: Обзор сценария
---

# Заметки — обзор

## Что это

Простое приложение для создания, просмотра, редактирования, поиска и
удаления заметок — заголовок и текст произвольного объёма (в пределах
лимитов, см. [правила](./business-rules)). Заметки хранятся в PostgreSQL.

Заметки **приватны**: каждая принадлежит создавшему её пользователю (см.
[«Авторизация»](/auth/overview)) — доступ к чужой заметке даёт `403`.

Каждому новому пользователю при первом входе заводится одна приветственная
заметка «Добро пожаловать» (см. [правила Auth](/auth/business-rules)): обычная
заметка, которую можно изменить или удалить.

## Где реализовано

| Слой | Компонент | Ответственность |
|---|---|---|
| Domain | `Note` | Сущность с инвариантами (лимиты title/text, владелец) |
| Domain | `NoteValidationException` | Нарушение бизнес-правил заметки |
| Application | `INoteService` / `NoteService` | Use case'ы: создать, получить список, получить по id, обновить, удалить, найти — все скоупятся по вызывающему пользователю |
| Application | `INoteRepository` | Порт для хранения и поиска заметок |
| Application | `SearchSnippetBuilder` | Фрагмент текста вокруг совпадения и разметка найденных мест (в том числе неточных) |
| Application | `NoteNotFoundException` | Заметка с указанным id не найдена |
| Application | `NoteAccessDeniedException` | Заметка существует, но принадлежит другому пользователю |
| Application | `WelcomeNote`, `WelcomeNoteRegistrationHandler` | Содержимое приветственной заметки и её создание новому пользователю (реализует порт `IUserRegistrationHandler` из Auth) |
| Infrastructure | `NotesDbContext`, `NoteRepository` | Реализация хранения и поиска через EF Core + PostgreSQL (поиск с опечатками — на триграммах, расширение `pg_trgm`) |
| Api (Presentation) | `NotesController` | REST-эндпоинты, требуют вход (см. [«Авторизация»](/auth/overview)), см. [контракт API](./api-contract) |
| Web (Presentation) | `MyApplication.Web.UI` | React-интерфейс, см. [интерфейс](./web-ui) |

## Дальше

- [Правила формирования и хранения заметок](./business-rules)
- [Контракт API](./api-contract)
- [Интерфейс](./web-ui)

