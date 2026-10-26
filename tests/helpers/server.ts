import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { FastifyInstance } from "fastify";

/**
 * Запустить приложение на свободном порту, если оно ещё не слушает, и вернуть адрес MCP-эндпоинта
 */
export const listen = async (
  app: FastifyInstance,
  path = "/mcp",
): Promise<string> => {
  if (!app.server.listening) await app.listen({ port: 0, host: "127.0.0.1" });

  const address = app.server.address();

  if (!address || typeof address === "string") {
    throw new Error("Сервер не вернул порт");
  }

  return `http://127.0.0.1:${address.port}${path}`;
};

/**
 * Подключить настоящий MCP-клиент по Streamable HTTP с заголовками
 */
export const connect = async (
  url: string,
  headers: Record<string, string> = {},
): Promise<Client> => {
  const client = new Client({
    name: "fastify-mcp-routes-tests",
    version: "1.0.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: { headers },
  });

  await client.connect(transport);

  return client;
};

// Результат вызова инструмента в виде, удобном для проверок
export type ToolResult = {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
};

/**
 * Вызвать инструмент и вернуть результат с нужным типом
 */
export const call = async (
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

/**
 * Первый текстовый блок результата вызова инструмента
 */
export const textOf = (result: ToolResult): string => {
  const block = result.content[0];

  if (!block || block.type !== "text" || block.text === undefined) {
    throw new Error("В результате нет текстового блока");
  }

  return block.text;
};
