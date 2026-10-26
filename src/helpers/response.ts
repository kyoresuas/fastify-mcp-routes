import { McpContract } from "@/contracts/mcp";
import { parseJson } from "@/utils/primitive";
import { IInvokeOutcome } from "@/types/routes";
import type { CallToolResult } from "@modelcontextprotocol/server";

/**
 * Успешный результат инструмента с текстом
 */
export const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

/**
 * Результат инструмента с пометкой об ошибке
 */
export const errorResult = (text: string): CallToolResult => ({
  isError: true,
  content: [{ type: "text", text }],
});

/**
 * Оставить заголовки ответа, которые не меняются от вызова к вызову
 */
const stableHeaders = (
  headers: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(headers).filter(
      ([name]) =>
        !(McpContract.VOLATILE_HEADERS as readonly string[]).includes(
          name.toLowerCase(),
        ),
    ),
  );

/**
 * Превратить ответ маршрута в результат инструмента
 */
export const toToolResult = (
  method: string,
  outcome: IInvokeOutcome,
): CallToolResult => {
  const { status, payload, headers } = outcome;

  if (status >= 400) {
    const json = String(headers["content-type"] ?? "").includes("json");
    const body = json ? (parseJson(payload) ?? payload) : payload;

    return errorResult(JSON.stringify({ status, body }));
  }

  if (payload) return textResult(payload);

  // Пустое тело, например 204 или HEAD, описываем статусом
  const withHeaders = method === "HEAD" || status >= 300;

  return textResult(
    JSON.stringify(
      withHeaders ? { status, headers: stableHeaders(headers) } : { status },
    ),
  );
};
