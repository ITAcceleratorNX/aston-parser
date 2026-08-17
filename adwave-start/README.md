# Adwave Parser

Автоматическая выгрузка данных из [Adwave](https://dash.adwave.guru) через внутренние read-only запросы дашборда. Браузерный скрапинг не используется. Стек: Node.js.

## Быстрый старт

```bash
npm install
cp .env.example .env
chmod 600 .env
# укажите ADWAVE_PHONE в .env (только цифры)

npm run login
npm run probe
npm run sync
```

Токены хранятся в `.secrets/tokens.json` (mode 600) и/или в `.env`. Их нельзя коммитить, логировать или вставлять в чаты.

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run login` / `node src/cli.js login` | WhatsApp OTP, сохранение JWT + refresh |
| `npm run refresh` | Принудительное обновление access JWT |
| `npm run probe` | Проверка auth и ключевых GET/POST |
| `node src/cli.js sync --entities sprint1 --days 7` | Выгрузка JSON/CSV + upsert в SQLite |
| `npm run stability` | Несколько запусков подряд |
| `node src/cli.js schedule --every-hours 6` | Цикл без ручного участия |

Период: `--from YYYY-MM-DD --to YYYY-MM-DD` или `--days N`.  
Сущности: `--entities sprint1|sprint2|all|projects,metrics,leads,qleads,...`

Нужен Node.js 18+. SQLite идёт через встроенный `node:sqlite` (Node 22+; на 18–21 поставьте Node 22).

## Документация

- [docs/RUNBOOK.md](docs/RUNBOOK.md) — запуск и обслуживание
- [docs/ENDPOINTS.md](docs/ENDPOINTS.md) — внутренние запросы
- [docs/SPRINT_REPORT.md](docs/SPRINT_REPORT.md) — контрольная точка спринта
