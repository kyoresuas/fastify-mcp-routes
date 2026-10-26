import type { FastifyInstance } from "fastify";
import type { ToolResult } from "../helpers/server";
import { it, expect, describe, afterEach } from "vitest";
import type { IMcpRoutesOptions } from "@/types/options";
import type { Client } from "@modelcontextprotocol/client";
import { call, listen, textOf, connect } from "../helpers/server";
import { API_KEY, API_TOKEN, buildFixtureApp } from "../fixtures/app";

let app: FastifyInstance;
let client: Client | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
  await app.close();
});

/**
 * Запустить приложение и подключить к нему настоящий MCP-клиент
 */
const start = async (
  options: IMcpRoutesOptions = {},
  headers: Record<string, string> = {},
): Promise<Client> => {
  app = await buildFixtureApp(options);
  client = await connect(await listen(app), headers);

  return client;
};

/**
 * Статус и тело из текста ошибки инструмента
 */
const errorOf = (result: ToolResult) =>
  JSON.parse(textOf(result)) as { status: number; body: unknown };

describe("tools/list", () => {
  it("отдаёт безопасные маршруты с именами из метода и URL", async () => {
    const { tools } = await (await start()).listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "get_clients",
      "get_clients_by_id",
      "get_reports_summary",
      "get_errors_not_found",
      "get_errors_crash",
    ]);
  });

  it("объединяет params и query в одну схему входа", async () => {
    const { tools } = await (await start()).listTools();
    const tool = tools.find((item) => item.name === "get_clients_by_id");

    expect({
      description: tool?.description,
      inputSchema: tool?.inputSchema,
      annotations: tool?.annotations,
    }).toEqual({
      description: "Get a client by id",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Client id" },
          expand: { type: "boolean" },
        },
        required: ["id"],
      },
      annotations: { readOnlyHint: true },
    });
  });

  it("раскладывает поля body по свойствам, когда POST открыт", async () => {
    const { tools } = await (
      await start({ allow: ["POST /clients"] })
    ).listTools();
    const tool = tools.find((item) => item.name === "post_clients");

    expect(tool?.description).toBe("Create a client");
    expect(tool?.inputSchema).toEqual({
      type: "object",
      properties: {
        name: { type: "string", minLength: 1 },
        plan: { type: "string", enum: ["free", "pro"] },
      },
      required: ["name"],
    });
  });

  it("не публикует сам эндпоинт /mcp", async () => {
    const { tools } = await (await start({ readOnly: false })).listTools();

    expect(tools.some((tool) => tool.name.includes("mcp"))).toBe(false);
  });
});

describe("tools/call", () => {
  it("возвращает то же тело, что app.inject", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_clients_by_id", {
      id: "1",
      expand: true,
    });
    const injected = await app.inject({ url: "/clients/1?expand=true" });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe(injected.payload);
    expect(JSON.parse(injected.payload)).toEqual({
      id: "1",
      name: "Alice",
      plan: "pro",
      expanded: true,
    });
  });

  it("передаёт query в маршрут", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_clients", { limit: 1 });
    const injected = await app.inject({ url: "/clients?limit=1" });

    expect(textOf(result)).toBe(injected.payload);
    expect(JSON.parse(injected.payload)).toHaveLength(1);
  });

  it("без Authorization отдаёт isError со статусом 401", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_reports_summary", {});

    expect(result.isError).toBe(true);
    expect(errorOf(result)).toEqual({
      status: 401,
      body: { error: "Unauthorized", message: "Credentials are required" },
    });
  });

  it("с Authorization пробрасывает заголовок и вызов успешен", async () => {
    const mcp = await start({}, { authorization: `Bearer ${API_TOKEN}` });
    const result = await call(mcp, "get_reports_summary", {});
    const injected = await app.inject({
      url: "/reports/summary",
      headers: { authorization: `Bearer ${API_TOKEN}` },
    });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe(injected.payload);
  });

  it("пробрасывает x-api-key", async () => {
    const mcp = await start({}, { "x-api-key": API_KEY });
    const result = await call(mcp, "get_reports_summary", {});

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      clients: 2,
    });
  });

  it("не пробрасывает заголовки вне списка forwardHeaders", async () => {
    const mcp = await start(
      { forwardHeaders: ["authorization"] },
      { "x-api-key": API_KEY },
    );
    const result = await call(mcp, "get_reports_summary", {});

    expect(result.isError).toBe(true);
    expect(errorOf(result).status).toBe(401);
  });

  it("отдаёт 404 маршрута как isError", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_errors_not_found", {});

    expect(result.isError).toBe(true);
    expect(errorOf(result)).toEqual({
      status: 404,
      body: { message: "Nothing here" },
    });
  });

  it("отдаёт 500 маршрута как isError", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_errors_crash", {});

    expect(result.isError).toBe(true);
    expect(errorOf(result).status).toBe(500);
  });

  it("отдаёт ошибку валидации Fastify как isError со статусом 400", async () => {
    const mcp = await start({ allow: ["POST /clients"] });
    const result = await call(mcp, "post_clients", { plan: "pro" });

    expect(result.isError).toBe(true);
    expect(errorOf(result).status).toBe(400);
  });

  it("игнорирует аргументы с именами из прототипа объекта", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_clients_by_id", {
      id: "1",
      constructor: "x",
      toString: 1,
    });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      id: "1",
      name: "Alice",
      plan: "pro",
    });
  });

  it("сообщает, что обязательный параметр пути не передан", async () => {
    const mcp = await start();
    const result = await call(mcp, "get_clients_by_id", {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Missing path parameter "id"');
  });

  it("сообщает о неизвестном инструменте", async () => {
    const mcp = await start();
    const result = await call(mcp, "nope", {});

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe('Unknown tool "nope"');
  });
});

describe("политика доступа", () => {
  it("закрывает POST по умолчанию", async () => {
    const mcp = await start();
    const { tools } = await mcp.listTools();
    const result = await call(mcp, "post_clients", { name: "Carol" });
    const clients = await app.inject({ url: "/clients" });

    expect(tools.some((tool) => tool.name === "post_clients")).toBe(false);
    expect(result.isError).toBe(true);
    expect(JSON.parse(clients.payload)).toHaveLength(2);
  });

  it("открывает POST через allow и создаёт клиента", async () => {
    const mcp = await start({ allow: ["POST /clients"] });
    const result = await call(mcp, "post_clients", {
      name: "Carol",
      plan: "pro",
    });
    const clients = await app.inject({ url: "/clients" });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({
      id: "3",
      name: "Carol",
      plan: "pro",
    });
    expect(JSON.parse(clients.payload)).toHaveLength(3);
  });

  it("открывает все методы при readOnly false", async () => {
    const { tools } = await (await start({ readOnly: false })).listTools();

    expect(tools.map((tool) => tool.name)).toContain("post_clients");
  });

  it("закрывает маршрут через deny, даже если он разрешён allow", async () => {
    const { tools } = await (
      await start({
        allow: ["POST /clients"],
        deny: ["POST /clients", "GET /reports/*"],
      })
    ).listTools();
    const names = tools.map((tool) => tool.name);

    expect(names).not.toContain("post_clients");
    expect(names).not.toContain("get_reports_summary");
    expect(names).toContain("get_clients");
  });
});

describe("защита эндпоинта", () => {
  it("отклоняет запрос с чужим Origin", async () => {
    app = await buildFixtureApp();

    const url = await listen(app);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(response.status).toBe(403);
  });

  it("пропускает Origin из allowedOrigins", async () => {
    app = await buildFixtureApp({ allowedOrigins: ["app.example"] });

    const url = await listen(app);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        origin: "https://app.example",
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    expect(response.status).toBe(200);
  });

  it("отвечает 405 на GET в stateless-режиме", async () => {
    app = await buildFixtureApp();

    const response = await fetch(await listen(app), {
      headers: { accept: "text/event-stream" },
    });

    expect(response.status).toBe(405);
  });

  it("отвечает 405 на DELETE, а с content-type json и пустым телом 400 от Fastify", async () => {
    app = await buildFixtureApp();

    const url = await listen(app);
    const plain = await fetch(url, { method: "DELETE" });
    const withBody = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const empty = await fetch(url, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
    });

    expect(plain.status).toBe(405);
    expect(withBody.status).toBe(405);
    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({
      code: "FST_ERR_CTP_EMPTY_JSON_BODY",
    });
  });

  it("поддерживает свой путь эндпоинта", async () => {
    app = await buildFixtureApp({ endpoint: "/agents/mcp" });
    client = await connect(await listen(app, "/agents/mcp"));

    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).not.toContain("get_agents_mcp");
    expect(tools).toHaveLength(5);
  });
});
