/**
 * Привести значение аргумента к строке для URL
 */
const serialize = (value: unknown): string =>
  typeof value === "object" ? JSON.stringify(value) : String(value);

/**
 * Подставить значения параметров в шаблон URL
 */
export const fillPath = (
  url: string,
  values: Record<string, unknown>,
): string =>
  url
    .replace(/:([A-Za-z_]\w*)(?:\([^)]*\))?\??/g, (_match, name: string) => {
      const value = values[name];

      return value === undefined ? "" : encodeURIComponent(serialize(value));
    })
    .replace("*", () => {
      const value = values["*"];

      return value === undefined
        ? ""
        : serialize(value).split("/").map(encodeURIComponent).join("/");
    });

/**
 * Собрать строку запроса с ведущим знаком вопроса или пустую строку
 */
export const toQueryString = (query: Record<string, unknown>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      search.append(key, serialize(item));
    }
  }

  const text = search.toString();

  return text ? `?${text}` : "";
};
