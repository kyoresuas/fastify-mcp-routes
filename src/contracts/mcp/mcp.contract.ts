/**
 * Константы MCP-плагина
 */
export const McpContract = {
  // Путь эндпоинта по умолчанию
  ENDPOINT: "/mcp",
  // Имя сервера по умолчанию
  SERVER_NAME: "fastify-mcp-routes",
  // Заголовки, которые уходят в маршрут приложения
  FORWARDED_HEADERS: ["authorization", "x-api-key"],
  // Методы, которые публикуются без явного разрешения
  SAFE_METHODS: ["GET", "HEAD"],
  // Методы, у которых есть смысл передавать тело запроса
  BODY_METHODS: ["POST", "PUT", "PATCH"],
  // Методы, которые никогда не становятся инструментами
  SKIPPED_METHODS: ["OPTIONS"],
  // Методы, которые допустимо указывать в правилах allow и deny
  RULE_METHODS: [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "*",
  ],
  // Заголовки ответа маршрута, которые меняются от вызова к вызову и не попадают в результат инструмента
  VOLATILE_HEADERS: ["date", "connection"],
  // Максимальная длина имени инструмента
  MAX_TOOL_NAME_LENGTH: 64,
  // Сколько символов приходится на один токен при оценке размера
  CHARS_PER_TOKEN: 4,
  // Название метода оценки для вывода в stats
  ESTIMATE_METHOD: "chars/4",
  // Имя аргумента с телом запроса, когда тело нельзя разложить на поля
  BODY_ARGUMENT: "body",
  // Имя аргумента с переменной частью wildcard-маршрута
  WILDCARD_ARGUMENT: "wildcard",
} as const;
