# Инструкция по запуску и обслуживанию

## 1. Установка

Нужен Node.js 22+ (встроенный `node:sqlite`).

```bash
cd adwave-parser
npm install
cp .env.example .env
chmod 600 .env
```

В `.env` укажите телефон аккаунта Adwave **только цифрами** (`ADWAVE_PHONE`) и при необходимости `ADWAVE_WORKSPACE_ID`.

## 2. Первичный вход (один раз)

Код подтверждения приходит владельцу аккаунта в WhatsApp. Не сохраняйте OTP, JWT и refresh token в чатах.

```bash
npm run login
```

Токены пишутся в `.secrets/tokens.json` (права `600`) и при наличии строк в `.env` обновляются там же. Парсер никогда не печатает сами токены.

## 3. Проверка refresh и доступа

```bash
npm run refresh
npm run probe
```

Ожидание: `probe.status = ok`, refresh обновляет access JWT без нового OTP.

## 4. Выгрузка

```bash
# Sprint 1: проекты, метрики, лиды, qLeads
node src/cli.js sync --entities sprint1 --from 2026-08-01 --to 2026-08-12

# Все сущности, включая кампании/ads/sales
node src/cli.js sync --entities all --days 7 --chunk-days 3
```

Результат:

- `data/runs/<timestamp>/*.json` и `*.csv`
- `data/adwave.sqlite` — upsert без дублей
- `data/journal.jsonl` — журнал запусков (без секретов)

## 5. Проверка стабильности

```bash
npm run stability
```

Смотрите `comparison.*.row_count_stable`, `schema_stable` и не появился ли запрос OTP.

## 6. Автозапуск

Вариант A — простой цикл:

```bash
node src/cli.js schedule --every-hours 6 --entities all --days 7
```

Вариант B — macOS LaunchAgent каждые 6 часов:

```bash
bash scripts/install_launchd.sh
```

## 7. Уведомления

Задайте `ADWAVE_NOTIFY_WEBHOOK` (Slack/Telegram bot webhook и т.п.). После `ADWAVE_NOTIFY_AFTER_FAILURES` подряд неуспешных запусков уйдёт JSON без токенов и телефонов.

## 8. Обслуживание

- Если `refresh` вернул `Invalid or expired refresh token` — нужен повторный `login` (WhatsApp OTP).
- Не коммитьте `.env`, `.secrets/`, `data/`, `node_modules/`.
- Экспорт лидов содержит PII (телефоны сделок). Это данные выгрузки, не логи. Храните `data/` как конфиденциальные файлы.
- Логи в `logs/parser.log` проходят redaction JWT/телефонов.

## 9. Если внутренний API перестанет работать

Браузерный скрапинг не включён в текущий прототип: API подтверждён. Альтернативы по ТЗ:

1. Playwright по UI дашборда
2. Полуручной CSV-экспорт из интерфейса
3. Официальный API/webhook Adwave, если появится
4. Прямые выгрузки из Meta Ads / Bitrix24
