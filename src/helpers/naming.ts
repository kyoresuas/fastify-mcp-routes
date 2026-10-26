import { McpContract } from "@/contracts/mcp";

/**
 * Привести строку к виду snake_case из латиницы и цифр
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

/**
 * Собрать часть имени из одного сегмента URL
 */
const segmentSlug = (segment: string): string =>
  slugify(
    segment
      .replace(/:([A-Za-z_]\w*)(\([^)]*\))?\??/g, "by_$1")
      .replace(/\*/g, "wildcard"),
  );

/**
 * Собрать часть имени инструмента из шаблона URL
 */
export const slugFromUrl = (url: string): string => {
  const parts = url.split("/").map(segmentSlug).filter(Boolean);

  return parts.length > 0 ? parts.join("_") : "root";
};

/**
 * Оставить в имени только символы, допустимые для инструмента MCP
 */
export const sanitizeToolName = (name: string): string =>
  name
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .slice(0, McpContract.MAX_TOOL_NAME_LENGTH);

/**
 * Собрать имя инструмента из метода и шаблона URL
 */
export const generateToolName = (method: string, url: string): string =>
  sanitizeToolName(`${method.toLowerCase()}_${slugFromUrl(url)}`);

/**
 * Подобрать имя, которого ещё нет среди занятых, добавив числовой суффикс
 */
export const uniqueName = (name: string, used: ReadonlySet<string>): string => {
  if (!used.has(name)) return name;

  let index = 2;
  let candidate = name;

  while (used.has(candidate)) {
    const suffix = `_${index}`;

    candidate = `${name.slice(0, McpContract.MAX_TOOL_NAME_LENGTH - suffix.length)}${suffix}`;
    index += 1;
  }

  return candidate;
};
