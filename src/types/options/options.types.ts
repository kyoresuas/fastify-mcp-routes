import { McpMode } from "@/types/shared";

export interface IMcpRouteConfig {
  // Имя инструмента вместо operationId или имени из метода и URL
  name?: string;
  // Описание инструмента вместо summary и description схемы
  description?: string;
  // Не публиковать маршрут в MCP
  hidden?: boolean;
}

export interface IMcpServerInfo {
  // Имя сервера в ответе initialize
  name?: string;
  // Версия сервера в ответе initialize
  version?: string;
}

export interface IMcpRoutesOptions {
  // Путь MCP-эндпоинта, по умолчанию /mcp
  endpoint?: string;
  // Режим tools публикует инструмент на маршрут, progressive три мета-инструмента
  mode?: McpMode;
  // Публиковать только GET и HEAD, по умолчанию true
  readOnly?: boolean;
  // Правила вида "POST /clients", открывают маршрут даже при readOnly
  allow?: string[];
  // Правила вида "GET /internal/*", закрывают маршрут и сильнее allow
  deny?: string[];
  // Заголовки запроса к MCP, которые уходят в маршрут приложения
  forwardHeaders?: string[];
  // Имена хостов из заголовка Origin, которым разрешён доступ к эндпоинту
  allowedOrigins?: string[];
  // Брать summary и description из @fastify/swagger, если он зарегистрирован
  swagger?: boolean;
  // Имя и версия сервера
  serverInfo?: IMcpServerInfo;
  // Подсказка модели, которую сервер отдаёт в initialize
  instructions?: string;
}

export interface IRouteRule {
  // HTTP-метод в верхнем регистре или * для любого
  method: string;
  // Скомпилированный шаблон URL
  pattern: RegExp;
}

export interface IResolvedOptions {
  // Путь MCP-эндпоинта
  endpoint: string;
  // Режим публикации
  mode: McpMode;
  // Только безопасные методы
  readOnly: boolean;
  // Правила, открывающие маршруты
  allow: IRouteRule[];
  // Правила, закрывающие маршруты
  deny: IRouteRule[];
  // Заголовки для проброса в нижнем регистре
  forwardHeaders: string[];
  // Допустимые хосты Origin
  allowedOrigins: string[];
  // Читать метаданные из @fastify/swagger
  swagger: boolean;
  // Имя сервера
  serverName: string;
  // Версия сервера
  serverVersion: string;
  // Подсказка модели
  instructions?: string;
}
