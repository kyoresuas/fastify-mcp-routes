# AGENTS.md

fastify-mcp-routes это плагин Fastify 5, который превращает маршруты приложения в инструменты MCP без кодогенерации и OpenAPI-файла. Источник правды: код в `src/` и схемы маршрутов приложения, которое подключает плагин. Всё в `dist/` собирается командой `npm run build`, руками не правится. Язык репозитория, комментариев и коммитов: русский. Тексты для пользователей библиотеки (README, ошибки, ответы инструментов) на английском.

## Карта репозитория

| Путь | Назначение |
| --- | --- |
| `src/index.ts` | Публичный API пакета: плагин `mcpRoutes` и типы |
| `src/plugins/mcpRoutes/` | Плагин Fastify: хук `onRoute`, эндпоинт `/mcp`, декоратор `app.mcpRoutes` |
| `src/services/registry/` | Сбор маршрутов из `onRoute`: метод, URL, схема, `config.mcp` |
| `src/services/policy/` | Какие маршруты публикуются: `readOnly`, `allow`, `deny`, `hidden` |
| `src/services/catalog/` | Описания инструментов: имена, `inputSchema`, поиск для режима progressive |
| `src/services/tools/` | Список для `tools/list` в режимах `tools` и `progressive` |
| `src/services/invoker/` | Вызов маршрута через `app.inject` с пробросом заголовков |
| `src/services/server/` | MCP-сервер на один HTTP-запрос, обработчики `tools/list` и `tools/call` |
| `src/services/stats/` | Оценка размера `tools/list` в токенах |
| `src/services/swagger/` | Чтение summary и description из `@fastify/swagger` |
| `src/helpers/` | Чистые функции: имена, правила, схемы, URL, ответы, опции |
| `src/contracts/` | Константы: эндпоинт, методы, имена мета-инструментов, коэффициент токенов |
| `src/types/` | Все интерфейсы и типы с барелями `index.ts`, включая расширение `fastify` |
| `tests/integration/` | Настоящий MCP-клиент по Streamable HTTP против `app.listen({ port: 0 })` |
| `tests/unit/` | Тесты чистых функций и сервисов |
| `tests/fixtures/`, `tests/helpers/` | Фикстура на шесть маршрутов, запуск сервера и клиента |
| `bench/` | Фикстуры на 5, 50 и 200 маршрутов и скрипт с таблицей размеров |
| `scripts/` | `render-bench.ts`: запускает `npm run bench` и рисует его вывод в `docs/bench.svg` |
| `docs/` | `bench.svg`: картинка первого экрана обоих README, генерируется скриптом, руками не правится |
| `.github/workflows/` | `ci.yml`: lint, тесты, сборка и bench на Node.js 22 и 24 |

## Команды

```bash
npm ci
npm run lint            # eslint, ноль предупреждений
npm test                # tsc --noEmit и vitest
npm run test:coverage   # покрытие v8
npm run build           # tsc в dist/ и замена алиаса @/ на относительные пути
npm run bench           # таблица размера tools/list для 5, 50 и 200 маршрутов
npm run docs:bench      # перерисовать docs/bench.svg по настоящему выводу bench
```

Сборка и тесты не ходят в сеть. Тесты поднимают сервер на свободном порту `127.0.0.1`.

## Как работает плагин

1. Плагин регистрируется через `fastify-plugin` до маршрутов и вешает хук `onRoute`.
2. `RouteRegistryService` запоминает метод, URL с префиксом, схему и `config.mcp` каждого маршрута.
3. `PolicyService` оставляет GET и HEAD, а мутации только по `allow` или при `readOnly: false`. `deny`, `hidden` и `schema.hide` сильнее.
4. `CatalogService` строит инструменты: имя из `config.mcp.name`, `operationId` или `метод_путь`, `inputSchema` из params, querystring и body.
5. На каждый запрос к `/mcp` создаётся новый сервер, состояние между запросами не хранится.
6. `InvokerService` вызывает маршрут через `app.inject` с заголовками `authorization` и `x-api-key` исходного запроса. Ответ 2xx и 3xx идёт текстом, 4xx и 5xx с `isError`.

Размер `tools/list` оценивается как число символов в `JSON.stringify(tools)`, делённое на 4 и округлённое вверх.

## Правила правки

- Безопасное поведение по умолчанию это публичный контракт: наружу только GET и HEAD, эндпоинт сам не публикуется, запрос с заголовком `Origin` отклоняется, пока хост не указан в `allowedOrigins`.
- Имена мета-инструментов `search_routes`, `describe_route`, `call_route` и правила именования инструментов не меняются без мажорной версии.
- Версии `@modelcontextprotocol/server`, `@modelcontextprotocol/node` и `@modelcontextprotocol/client` закреплены точно. Обновление проверяется полным прогоном тестов.
- Числа в README и AGENTS.md (три мета-инструмента, формула chars/4, таблица bench) берутся из вывода `npm run bench`, руками не пишутся.
- Картинка `docs/bench.svg` содержит только настоящий вывод `npm run bench`. После изменений, которые двигают числа, её перерисовывают командой `npm run docs:bench`, тест в `tests/unit/docs.test.ts` сверяет её с текущим выводом.
- Картинка стоит на первом экране обоих README, не дальше 1500 символов от начала. Тот же тест это проверяет.
- Тексты ошибок и ответы инструментов на английском, они видны пользователям библиотеки и моделям.

## Стиль кода

- TypeScript strict, ESM, алиас `@/` на `src/`. Импорты в файле выстроены лесенкой по длине строки.
- JSDoc на русском на каждой функции и методе, без точки в конце. Внутри функций комментарии только для неочевидного.
- Сервисы это классы с явными зависимостями в конструкторе, без DI-контейнера. Константы в `contracts`.
- Все `interface`, `type` и `enum` живут только в `src/types/<модуль>/<модуль>.types.ts` с барелем `index.ts`. Типы, ссылающиеся на классы сервисов, импортируются через `import type`.
- Библиотека не пишет в `console` и не читает `process.env`, события уходят в `app.log`.
- Без эмодзи и без длинных тире в коде, документации и коммитах.

## Проверка перед завершением

```bash
npm run lint && npm test && npm run build && npm run bench
```

Если менялись `src/services` или `src/helpers`, дополнительно обновить таблицу в `README.md` и `README_RU.md` по выводу `npm run bench` и перерисовать `docs/bench.svg` командой `npm run docs:bench`. Тесты на новую логику обязательны.

## Git

Агент не делает `git commit` и `git push`, а предлагает текст коммита. Формат conventional commits с русским описанием: `feat: …`, `fix: …`, `docs: …`, `chore: …`. Никаких `--force`, `--no-verify` и `reset --hard`.

## Спросить сначала

Смена безопасных значений по умолчанию, переименование инструментов или опций, обновление мажорной версии MCP SDK, правки `permissions` и секретов в workflows, смена лицензии, публикация в npm.

## Ссылки

`README.md` и `README_RU.md` для людей, `SECURITY.md`, шаблоны issue в `.github/ISSUE_TEMPLATE/`, документация MCP TypeScript SDK: https://ts.sdk.modelcontextprotocol.io/v2/
