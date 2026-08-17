# Проверенные внутренние запросы Adwave

Источник: фронтенд `https://dash.adwave.guru/assets/index-CeBFI1aJ.js` (актуален на 12.08.2026) + живые probe-запросы без токена.

Base URL: `https://dash.adwave.guru/api/`  
Workspace из ТЗ: `69916ea2430b6f31d9cb0d8a`

## Авторизация

| Метод | Путь | Тело | Назначение |
| --- | --- | --- | --- |
| POST | `auth/send-code` | `{ "phoneNumber": "<digits>" }` | WhatsApp OTP |
| POST | `auth/verify-code` | `{ "phoneNumber", "code" }` | Ответ: `accessToken`, `refreshToken` |
| POST | `auth/refresh` | `{ "refreshToken" }` | Обновление JWT |
| POST | `auth/login` | email/password | Альтернативный вход, парсером не используется |

Токены в SPA: `localStorage["dashboard-token"]`, `localStorage["dashboard-refresh-token"]`.  
Заголовок: `Authorization: Bearer <accessToken>`.

Живые ответы без валидных токенов:

- `GET /workspaces` → `401 Unauthorized`
- `POST /auth/refresh` с пустым телом → `401 Invalid or expired refresh token`
- `POST /auth/send-code` → `201 {}` (эндпоинт живой)

Известный баг SPA: после refresh в interceptor пишется `Bearer ${rt.token}`, хотя сохраняется `rt.accessToken`. Парсер использует `accessToken || token`.

## Read-only данные

| Сущность | Метод | Путь | Query | Body |
| --- | --- | --- | --- | --- |
| profile | GET | `user/profile` | | |
| workspaces | GET | `workspaces` | | |
| workspace | GET | `workspaces/{id}` | | |
| projects | GET | `workspaces/{id}/projects` | | |
| metrics | POST | `workspaces/{id}/dashboards/byProjects` | `from`, `to` (`YYYY-MM-DD`) | `{}` или фильтры |
| campaigns | POST | `workspaces/{id}/dashboards/byAdCampaigns` | `from`, `to` | `{ projectIds }` |
| adsets | POST | `workspaces/{id}/dashboards/byAdSets` | `from`, `to` | `{ projectIds, campaignIds }` |
| ads | POST | `workspaces/{id}/dashboards/byAds` | `from`, `to` | `{ projectIds, campaignIds, adSetIds }` |
| leads | POST | `workspaces/{id}/dashboards/leads` | `from`, `to` | `{ projectIds, campaignIds, adSetIds, adIds }` |
| qLeads | POST | `workspaces/{id}/dashboards/qLeads` | `from`, `to` | то же |
| sales | POST | `workspaces/{id}/dashboards/sales` | `from`, `to` | то же |

Пустые фильтры в UI означают «все записи». Парсер по умолчанию шлёт `{}`.

Формат ответа dashboard (по demo-bundle SPA):

- метрики: `{ projects, accounts, campaigns, adSets, ads, insights[] }`
- лиды/продажи: `{ ..., leads[], insights[] }`

Поля insights: `spend`, `impressions`, `clicks`, `reach`, `leads`, `qLeads`, `sales`, `ctr`, `cpc`, `cpm`, `cpl`, `cpql`, `cps`, `romi`, `result`, `totalPriceUsd`, ...

Поля лидов: `_id`, `leadId`, `dealId`, `phone`, `dealName`, `pipelineName`, `pipelineStage`, `createdAtByUtcFormatted`, `saleDateByUtcFormatted`, ...

## Что сознательно не вызывается

Write-эндпоинты (создание проекта, invite, link deal, blocklist, webhooks) парсер не использует.
