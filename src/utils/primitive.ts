/**
 * Проверить, что значение это обычный объект без прототипа класса
 */
export const isPlainObject = (
  value: unknown,
): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
};

/**
 * Привести значение к непустой строке или вернуть undefined
 */
export const toText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Убрать дубликаты, сохранив порядок
 */
export const unique = <T>(items: Iterable<T>): T[] => [...new Set(items)];

/**
 * Разобрать строку как JSON и вернуть undefined при ошибке
 */
export const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};
