/**
 * JSON Schema в виде обычного объекта
 */
export type JsonSchema = Record<string, unknown>;

/**
 * Режим публикации маршрутов в MCP
 */
export type McpMode = "tools" | "progressive";

/**
 * Часть запроса, в которую уходит аргумент инструмента
 */
export type ArgTarget = "params" | "query" | "body";
