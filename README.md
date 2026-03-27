# Vector Graphic Editor

Образовательный проект по разработке векторного графического редактора frontend (Vue 3 + TypeScript + Canvas 2D) и backend (Spring Boot + MongoDB).

Сам редактор [тут](https://fami-2026.github.io/vector-graphic-editor/).

## Что есть в проекте

- Набор фигур: прямоугольник, круг, линия, треугольник, многоугольник, звезда, шестиугольник, стрелка
- Рисование фигур на холсте и интерактивное создание многоугольника с выбором количества углов
- Выделение фигур, перемещение, изменение размеров и вращение
- Панорамирование сцены (инструмент «рука») и масштабирование
- Undo/redo с горячими клавишами (Ctrl + Z, Ctrl + Y)
- Экспорт сцены в PNG (настройка фона и качества) и экспорт/импорт проектов в JSON
- Автосохранение состояния в `localStorage`
- REST API для хранения/получения состояния холстов в MongoDB

## Структура репозитория

```text
.
├── frontend/                # клиентская часть
├── server/                  # backend API
├── compose.yaml             # объединяет frontend/server compose
├── Taskfile.yaml            # агрегирующие команды
├── CONTRIBUTING.md          # правила участия
└── README.md
```

## Быстрый старт (Docker Compose)

Требования:

- Docker + Docker Compose
- `task` (опционально)

1) Подготовить переменные для MongoDB:

```bash
export MONGO_USER=admin
export MONGO_PASS=admin
```

2) Создать сеть (если ещё не создана):

```bash
docker network create vge || true
```

3) Поднять проект:

```bash
docker compose up -d
```

После запуска:

- Frontend: `http://localhost:5000`
- Backend API: `http://localhost:8080/api`
- MongoDB: `localhost:27017`

## Запуск через Taskfile

Из корня:

```bash
# Сборка docker-образов frontend + server
task image

# Публикация образов в registry
task publish

# Деплой локально через compose
task deploy
```

Полезные подзадачи:

- `task server:image|publish|deploy|format`
- `task client:ci|ci:build|lint|format|image|publish|deploy|dev:run`

`task client:dev:run` запускает Vite с портом `5000` и прокидывает `VITE_SERVER_ADDR=localhost:8080`.

## Локальный запуск без Docker

### Backend (`server`)

1) Подготовить конфигурацию. В репозитории есть `server/src/main/resources/application.example.yml` — скопируйте его в `application.yml` и подставьте реальные значения, либо задайте эквивалентные переменные окружения Spring Boot.
2) Запустить MongoDB локально.
3) Запустить backend:

```bash
cd server
./gradlew bootRun
```

Примечание: в docker-окружении используется `SERVER_SERVLET_CONTEXT_PATH=/api`, поэтому итоговые URL будут вида `/api/canvas`. При локальном запуске без этого параметра префикса `/api` может не быть.

### Frontend (`frontend`)

Проект находится в поддиректории `frontend/`. Все команды нужно выполнять из этой папки.

```bash
# 1. Перейти в директорию проекта
cd frontend

# 2. Установить зависимости
npm install

# 3. Запустить в режиме разработки
npm run dev
```

По умолчанию Vite поднимается на `http://localhost:5173` (или другой порт, указанный в терминале).

### Другие полезные команды фронтенда

```bash
# Сборка production-версии
npm run build

# Предпросмотр собранной версии локально
npm run preview

# Запуск линтера
npm run lint
```

## Конфигурация клиента

Адрес сервера встраивается в клиента на этапе сборки и доступен через `import.meta.env.VITE_SERVER_ADDR`.

Пример:

```js
const server = import.meta.env.VITE_SERVER_ADDR;

fetch(`http://${server}/api/canvas`, { mode: 'cors' })
    .then((response) => response.json())
    .then((response) => console.log(response));
```

## Backend API

OpenAPI спецификация: `server/docs/openapi.yml`

Базовые эндпоинты:

- `GET /canvas` — список метаданных холстов
- `GET /canvas/{id}` — конкретный холст
- `POST /canvas` — создать холст
- `PUT /canvas/{id}` — обновить холст
- `DELETE /canvas/{id}` — удалить холст

Формат ответа:

```json
{
  "code": 200,
  "message": null,
  "data": {}
}
```

Пример тела запроса `POST /canvas`:

```json
{
  "content": "{}"
}
```

## Процесс разработки

Правила ветвления, PR, rebase и ревью описаны в `CONTRIBUTING.md`.
