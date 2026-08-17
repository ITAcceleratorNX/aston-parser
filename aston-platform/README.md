# Aston Platform

Веб-платформа аналитики рекламных данных Aston на базе парсера AdWave.

## Состав

- `../adwave-start` — готовый парсер AdWave (источник данных)
- `backend` — API: метрики, KPI, сравнение периодов, аналитика
- `frontend` — интерфейс: таблицы, фильтры, экспорт

## Быстрый старт

### 1. Данные парсера

```bash
cd ../adwave-start
npm run sync
# или конкретный период:
node src/cli.js sync --entities metrics,projects --from 2026-08-01 --to 2026-08-12
```

### 2. Backend

```bash
cd backend
npm install
npm run dev
# http://localhost:3001
```

Логин по умолчанию: `admin` / `aston123` (см. `backend/.env`).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

## Что умеет

- выбор периода `from` / `to`
- уровни: проекты, кабинеты, кампании, группы, объявления
- KPI: CTR, CPC, CPM, CPR
- сортировка, поиск, структурные и числовые фильтры
- сравнение с предыдущим аналогичным периодом
- лучшие / слабые объекты, расход без результата
- доля бюджета и доля результатов
- экспорт текущей выборки в CSV

## API

| Метод | Путь | Описание |
| --- | --- | --- |
| POST | `/api/auth/login` | вход |
| GET | `/api/metrics?level=&from=&to=` | таблица + KPI |
| GET | `/api/metrics/compare?...` | сравнение периодов |
| GET | `/api/metrics/options?...` | списки для фильтров |
| GET | `/api/analytics?...` | аналитические блоки |
| GET | `/api/health` | статус |

## Деплой для демо

**Render** — backend (и может отдавать frontend).
**Vercel** — отдельный frontend.

### Render

1. Залить репозиторий на GitHub.
2. [render.com](https://render.com) → New → Blueprint, выбрать `render.yaml`.
3. После деплоя URL вида `https://aston-api.onrender.com`.
4. Логин: `admin` / `aston123`.

Free-план Render засыпает: первый заход может занять 30–60 секунд.

### Vercel

1. [vercel.com](https://vercel.com) → Import Git Repository.
2. Root Directory: `aston-platform/frontend`.
3. Environment Variable:
   - `VITE_API_URL` = `https://aston-api.onrender.com/api` (свой URL Render).
4. Deploy.

Локально frontend без этой переменной ходит на `http://localhost:3001/api`.

