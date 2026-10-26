/**
 * Мета-инструменты режима progressive
 */
export const ProgressiveContract = {
  // Поиск маршрутов по словам
  SEARCH: "search_routes",
  // Полное описание одного маршрута
  DESCRIBE: "describe_route",
  // Вызов маршрута по имени
  CALL: "call_route",
  // Сколько маршрутов возвращает поиск по умолчанию
  DEFAULT_LIMIT: 10,
  // Сколько маршрутов возвращает поиск не больше
  MAX_LIMIT: 50,
} as const;
