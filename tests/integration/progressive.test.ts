import type { FastifyInstance } from "fastify";
import { buildSyntheticApp } from "../../bench/fixture";
import { it, expect, describe, afterEach } from "vitest";
import type { Client } from "@modelcontextprotocol/client";
import { API_TOKEN, buildFixtureApp } from "../fixtures/app";
import { call, listen, textOf, connect } from "../helpers/server";

const apps: FastifyInstance[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((item) => item.close()));
  await Promise.all(apps.splice(0).map((item) => item.close()));
});

/**
 * Запустить приложение и подключить к нему MCP-клиент, закрытие в afterEach
 */
const start = async (
  app: FastifyInstance,
  headers: Record<string, string> = {},
): Promise<Client> => {
  apps.push(app);

  const client = await connect(await listen(app), headers);

  clients.push(client);

  return client;
};

describe("режим progressive", () => {
  it("отдаёт ровно три мета-инструмента при 5, 50 и 200 маршрутах", async () => {
    const sizes: number[] = [];
    const lengths: number[] = [];

    for (const count of [5, 50, 200]) {
      const client = await start(
        await buildSyntheticApp(count, {
          mode: "progressive",
          readOnly: false,
        }),
      );
      const { tools } = await client.listTools();

      sizes.push(tools.length);
      lengths.push(JSON.stringify(tools).length);
      expect(tools.map((tool) => tool.name)).toEqual([
        "search_routes",
        "describe_route",
        "call_route",
      ]);
    }

    expect(sizes).toEqual([3, 3, 3]);
    expect(new Set(lengths).size).toBe(1);
  });

  it("растит tools/list в режиме tools вместе с числом маршрутов", async () => {
    const counts: number[] = [];

    for (const count of [5, 50, 200]) {
      const client = await start(
        await buildSyntheticApp(count, { readOnly: false }),
      );

      counts.push((await client.listTools()).tools.length);
    }

    expect(counts).toEqual([5, 50, 200]);
  });

  it("ищет маршруты по словам", async () => {
    const client = await start(await buildFixtureApp({ mode: "progressive" }));

    const result = await call(client, "search_routes", { query: "clients" });
    const found = JSON.parse(textOf(result)) as {
      matched: number;
      routes: Array<{ name: string; method: string; url: string }>;
    };

    expect(found.matched).toBe(2);
    expect(found.routes.map((route) => route.name)).toEqual([
      "get_clients",
      "get_clients_by_id",
    ]);
    expect(found.routes[1]).toEqual({
      name: "get_clients_by_id",
      method: "GET",
      url: "/clients/:id",
      description: "Get a client by id",
    });
  });

  it("ограничивает выдачу поиска параметром limit", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const client = await start(app);

    const result = await call(client, "search_routes", { limit: 2 });
    const found = JSON.parse(textOf(result)) as {
      matched: number;
      routes: unknown[];
    };

    expect(found.matched).toBe(5);
    expect(found.routes).toHaveLength(2);
  });

  it("описывает маршрут вместе со схемой входа", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const client = await start(app);

    const result = await call(client, "describe_route", {
      name: "get_clients_by_id",
    });

    expect(JSON.parse(textOf(result))).toEqual({
      name: "get_clients_by_id",
      method: "GET",
      url: "/clients/:id",
      description: "Get a client by id",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Client id" },
          expand: { type: "boolean" },
        },
        required: ["id"],
      },
    });
  });

  it("call_route вызывает нужный маршрут и возвращает то же, что inject", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const client = await start(app);

    const result = await call(client, "call_route", {
      name: "get_clients_by_id",
      arguments: { id: "2", expand: true },
    });
    const injected = await app.inject({ url: "/clients/2?expand=true" });

    expect(result.isError).toBeFalsy();
    expect(textOf(result)).toBe(injected.payload);
  });

  it("call_route без Authorization отдаёт isError 401, с ним успех", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const anonymous = await start(app);
    const authorized = await connect(await listen(app), {
      authorization: `Bearer ${API_TOKEN}`,
    });

    clients.push(authorized);

    const denied = await call(anonymous, "call_route", {
      name: "get_reports_summary",
    });
    const allowed = await call(authorized, "call_route", {
      name: "get_reports_summary",
    });

    expect(denied.isError).toBe(true);
    expect(JSON.parse(textOf(denied)).status).toBe(401);
    expect(allowed.isError).toBeFalsy();
    expect(JSON.parse(textOf(allowed))).toEqual({ clients: 2 });
  });

  it("не вызывает закрытые маршруты через call_route", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const client = await start(app);

    const result = await call(client, "call_route", {
      name: "post_clients",
      arguments: { name: "Carol" },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unknown route "post_clients"');
  });

  it("сообщает об ошибке 404 маршрута как isError", async () => {
    const app = await buildFixtureApp({ mode: "progressive" });
    const client = await start(app);

    const result = await call(client, "call_route", {
      name: "get_errors_not_found",
    });

    expect(result.isError).toBe(true);
    expect(JSON.parse(textOf(result)).status).toBe(404);
  });
});
