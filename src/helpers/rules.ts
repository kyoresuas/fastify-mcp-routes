import { IRouteRule } from "@/types/options";
import { McpContract } from "@/contracts/mcp";
import { IRouteRecord } from "@/types/routes";

/**
 * Скомпилировать правило вида "POST /clients" или "/internal/*"
 */
export const compileRule = (rule: string): IRouteRule => {
  const parts = rule.trim().split(/\s+/);
  const hasMethod = parts.length > 1;
  const method = hasMethod ? parts[0]!.toUpperCase() : "*";
  const path = (hasMethod ? parts.slice(1).join(" ") : parts[0]!).replace(
    /(.)\/+$/,
    "$1",
  );

  if (!(McpContract.RULE_METHODS as readonly string[]).includes(method)) {
    throw new Error(`Unknown HTTP method in rule "${rule}"`);
  }

  if (!path.startsWith("/") && !path.startsWith("*")) {
    throw new Error(`The URL in rule "${rule}" must start with "/" or "*"`);
  }

  const body = path
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/^\/$/, "");

  return { method, pattern: new RegExp(`^${body}/?$`) };
};

/**
 * Проверить, что маршрут подпадает под правило
 */
export const matchesRule = (
  rule: IRouteRule,
  route: Pick<IRouteRecord, "method" | "url">,
): boolean =>
  (rule.method === "*" || rule.method === route.method) &&
  rule.pattern.test(route.url);
