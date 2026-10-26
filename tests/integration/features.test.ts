import Fastify from "fastify";
import { mcpRoutes } from "@/index";
import swagger from "@fastify/swagger";
import { createApp } from "../helpers/app";
import type { FastifyInstance } from "fastify";
import { it, expect, describe, afterEach } from "vitest";
import type { IMcpRoutesOptions } from "@/types/options";
import type { Client } from "@modelcontextprotocol/client";
import { call, listen, textOf, connect } from "../helpers/server";

const apps: FastifyInstance[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((item) => item.close()));
  await Promise.all(apps.splice(0).map((item) => item.close()));
});

/**
 * Создать приложение с маршрутами теста и подключить MCP-клиент
 */
const start = async (
  register: (app: FastifyInstance) => void | Promise<void>,
  options: IMcpRoutesOptions = {},
  prepare?: (app: FastifyInstance) => Promise<void>,
): Promise<{ app: FastifyInstance; client: Client }> => {
  const app = await createApp(options, register, prepare);

  apps.push(app);

  const client = await connect(await listen(app));

  clients.push(client);

  return { app, client };
};

describe("настройки маршрута", () => {
  it("берёт имя и описание из config.mcp", async () => {
    const { client } = await start((app) => {
      app.get(
        "/clients",
        {
          schema: { summary: "Schema summary" },
          config: {
            mcp: { name: "list_all_clients", description: "From config" },
          },
        },
        async () => [],
      );
    });
    const { tools } = await client.listTools();

    expect(tools.map((tool) => [tool.name, tool.description])).toEqual([
      ["list_all_clients", "From config"],
    ]);
  });

  it("скрывает маршрут через config.mcp.hidden и schema.hide", async () => {
    const { client } = await start((app) => {
      app.get("/open", async () => ({}));
      app.get(
        "/secret",
        { config: { mcp: { hidden: true } } },
        async () => ({}),
      );
      app.get("/docs", { schema: { hide: true } }, async () => ({}));
    });
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["get_open"]);
  });

  it("берёт имя из operationId и разводит одинаковые имена", async () => {
    const { client } = await start((app) => {
      app.get("/a", { schema: { operationId: "findThing" } }, async () => ({}));
      app.get("/b", { schema: { operationId: "findThing" } }, async () => ({}));
      app.get("/c", { schema: { operationId: "bad name!" } }, async () => ({}));
    });
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual([
      "findThing",
      "findThing_2",
      "bad_name_",
    ]);
  });

  it("подставляет метод и URL, когда описания нет", async () => {
    const { client } = await start((app) => {
      app.get("/ping", async () => ({}));
    });
    const { tools } = await client.listTools();

    expect(tools[0]?.description).toBe("GET /ping");
  });

  it("учитывает префикс при регистрации маршрутов", async () => {
    const { client } = await start((app) => {
      app.register(
        async (child) => {
          child.get("/clients/:id", async (request) => ({
            seen: (request.params as { id: string }).id,
            url: request.url,
          }));
        },
        { prefix: "/api" },
      );
    });
    const { tools } = await client.listTools();
    const result = await call(client, tools[0]!.name, { id: "7" });

    expect(tools[0]?.name).toBe("get_api_clients_by_id");
    expect(JSON.parse(textOf(result))).toEqual({
      seen: "7",
      url: "/api/clients/7",
    });
  });

  it("раскладывает маршрут с несколькими методами по записям", async () => {
    const { client } = await start((app) => {
      app.route({
        method: ["GET", "DELETE", "POST"],
        url: "/multi",
        handler: async () => ({}),
      });
    });
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(["get_multi"]);
  });
});

describe("область регистрации", () => {
  it("собирает только маршруты своей области и защищает эндпоинт её хуками", async () => {
    const app = Fastify();

    apps.push(app);
    app.get("/outside", async () => ({}));
    await app.register(
      async (scope) => {
        scope.addHook("onRequest", async (request, reply) => {
          if (!request.headers.authorization) {
            await reply.code(401).send({ message: "Credentials are required" });
          }
        });
        await scope.register(mcpRoutes);
        scope.get("/inside", async () => ({ inside: true }));
      },
      { prefix: "/api" },
    );
    await app.ready();

    const url = await listen(app, "/api/mcp");
    const anonymous = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    const client = await connect(url, { authorization: "Bearer any" });

    clients.push(client);

    const { tools } = await client.listTools();
    const result = await call(client, "get_api_inside");

    expect(anonymous.status).toBe(401);
    expect(tools.map((tool) => tool.name)).toEqual(["get_api_inside"]);
    expect(JSON.parse(textOf(result))).toEqual({ inside: true });
  });
});

describe("методы и аннотации", () => {
  it("публикует HEAD один раз и не дублирует автоматический HEAD к GET", async () => {
    const { client } = await start((app) => {
      app.get("/page", async () => ({ ok: true }));
      app.head("/ping", async (_request, reply) =>
        reply.header("x-pong", "1").code(200).send(),
      );
    });
    const { tools } = await client.listTools();
    const result = await call(client, "head_ping");
    const text = JSON.parse(textOf(result)) as {
      status: number;
      headers: Record<string, string>;
    };

    expect(tools.map((tool) => tool.name)).toEqual(["get_page", "head_ping"]);
    expect(text.status).toBe(200);
    expect(text.headers["x-pong"]).toBe("1");
  });

  it("не отдаёт в результате заголовки date и connection", async () => {
    const { client } = await start((app) => {
      app.head("/ping", async (_request, reply) =>
        reply.header("x-pong", "1").code(200).send(),
      );
      app.get("/old", async (_request, reply) => reply.redirect("/new"));
    });
    const head = await call(client, "head_ping");
    const redirect = await call(client, "get_old");
    const headers = [head, redirect].map(
      (result) =>
        (JSON.parse(textOf(result)) as { headers: Record<string, string> })
          .headers,
    );

    expect(Object.keys(headers[0]!)).toContain("x-pong");
    expect(headers[1]!["location"]).toBe("/new");
    for (const item of headers) {
      expect(item).not.toHaveProperty("date");
      expect(item).not.toHaveProperty("connection");
    }
  });

  it("помечает мутации подсказками для клиента", async () => {
    const { client } = await start(
      (app) => {
        app.delete("/things/:id", async () => ({}));
        app.put("/things/:id", async () => ({}));
        app.post("/things", async () => ({}));
      },
      { readOnly: false },
    );
    const { tools } = await client.listTools();
    const hints = Object.fromEntries(
      tools.map((tool) => [tool.name, tool.annotations]),
    );

    expect(hints).toEqual({
      delete_things_by_id: { destructiveHint: true },
      put_things_by_id: { idempotentHint: true },
      post_things: undefined,
    });
  });

  it("принимает тело POST без схемы одним аргументом body", async () => {
    const { client } = await start(
      (app) => {
        app.post("/echo", async (request) => request.body);
      },
      { allow: ["POST /echo"] },
    );
    const { tools } = await client.listTools();
    const result = await call(client, "post_echo", { body: { a: 1 } });

    expect(tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: {
        body: { type: "object", description: "JSON request body" },
      },
    });
    expect(JSON.parse(textOf(result))).toEqual({ a: 1 });
  });

  it("передаёт массив в body одним аргументом", async () => {
    const { client } = await start(
      (app) => {
        app.post(
          "/batch",
          { schema: { body: { type: "array", items: { type: "integer" } } } },
          async (request) => ({ count: (request.body as number[]).length }),
        );
      },
      { allow: ["POST /batch"] },
    );
    const { tools } = await client.listTools();
    const result = await call(client, "post_batch", { body: [1, 2, 3] });

    expect(tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: { body: { type: "array", items: { type: "integer" } } },
      required: ["body"],
    });
    expect(JSON.parse(textOf(result))).toEqual({ count: 3 });
  });
});

describe("схемы входа", () => {
  it("разводит одинаковые имена в params и body", async () => {
    const { client } = await start(
      (app) => {
        app.put(
          "/things/:id",
          {
            schema: {
              params: {
                type: "object",
                properties: { id: { type: "string" } },
              },
              body: {
                type: "object",
                properties: {
                  id: { type: "integer" },
                  title: { type: "string" },
                },
              },
            },
          },
          async (request) => ({
            params: request.params,
            body: request.body,
          }),
        );
      },
      { allow: ["PUT /things/:id"] },
    );
    const { tools } = await client.listTools();
    const result = await call(client, "put_things_by_id", {
      id: "abc",
      body_id: 5,
      title: "x",
    });

    expect(Object.keys(tools[0]!.inputSchema.properties ?? {})).toEqual([
      "id",
      "body_id",
      "title",
    ]);
    expect(JSON.parse(textOf(result))).toEqual({
      params: { id: "abc" },
      body: { id: 5, title: "x" },
    });
  });

  it("выводит параметры пути из URL, когда схемы params нет", async () => {
    const { client } = await start((app) => {
      app.get("/orgs/:org/repos/:repo", async (request) => request.params);
    });
    const { tools } = await client.listTools();
    const result = await call(client, "get_orgs_by_org_repos_by_repo", {
      org: "acme",
      repo: "a b/c",
    });

    expect(tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: { org: { type: "string" }, repo: { type: "string" } },
      required: ["org", "repo"],
    });
    expect(JSON.parse(textOf(result))).toEqual({ org: "acme", repo: "a b/c" });
  });

  it("передаёт переменную часть wildcard-маршрута", async () => {
    const { client } = await start((app) => {
      app.get("/files/*", async (request) => ({
        path: (request.params as Record<string, string>)["*"],
      }));
    });
    const { tools } = await client.listTools();
    const result = await call(client, "get_files_wildcard", {
      wildcard: "docs/a b.txt",
    });

    expect(Object.keys(tools[0]!.inputSchema.properties ?? {})).toEqual([
      "wildcard",
    ]);
    expect(JSON.parse(textOf(result))).toEqual({ path: "docs/a b.txt" });
  });

  it("не требует необязательный параметр пути", async () => {
    const { client } = await start((app) => {
      app.get("/items/:id?", async (request) => request.params);
    });
    const { tools } = await client.listTools();
    const withId = await call(client, "get_items_by_id", { id: "5" });
    const without = await call(client, "get_items_by_id");

    expect(tools[0]?.inputSchema.required).toBeUndefined();
    expect(JSON.parse(textOf(withId))).toEqual({ id: "5" });
    expect(without.isError).toBeFalsy();
  });

  it("передаёт пропущенный необязательный параметр пустой строкой", async () => {
    const { client } = await start((app) => {
      app.get("/items/:id?", async (request) => request.params);
    });
    const without = await call(client, "get_items_by_id");

    expect(JSON.parse(textOf(without))).toEqual({ id: "" });
  });

  it("передаёт массивы в строку запроса повторяющимися ключами", async () => {
    const { client } = await start((app) => {
      app.get(
        "/search",
        {
          schema: {
            querystring: {
              type: "object",
              properties: {
                tag: { type: "array", items: { type: "string" } },
                q: { type: "string" },
              },
            },
          },
        },
        async (request) => request.query,
      );
    });
    const result = await call(client, "get_search", {
      tag: ["a", "b"],
      q: "x y",
    });

    expect(JSON.parse(textOf(result))).toEqual({ tag: ["a", "b"], q: "x y" });
  });

  it("раскрывает $ref на общие схемы приложения", async () => {
    const { client, app } = await start(
      (instance) => {
        instance.post(
          "/people",
          { schema: { body: { $ref: "Person#" } } },
          async (request) => request.body,
        );
      },
      { allow: ["POST /people"] },
      async (instance) => {
        instance.addSchema({
          $id: "Person",
          type: "object",
          properties: {
            name: { type: "string" },
            address: { $ref: "Address#" },
          },
          required: ["name"],
        });
        instance.addSchema({
          $id: "Address",
          type: "object",
          properties: { city: { type: "string" } },
        });
      },
    );
    const { tools } = await client.listTools();
    const result = await call(client, "post_people", {
      name: "Eve",
      address: { city: "Oslo" },
    });

    expect(tools[0]?.inputSchema).toEqual({
      type: "object",
      properties: {
        name: { type: "string" },
        address: { type: "object", properties: { city: { type: "string" } } },
      },
      required: ["name"],
    });
    expect(JSON.parse(textOf(result))).toEqual({
      name: "Eve",
      address: { city: "Oslo" },
    });
    expect(app.mcpRoutes.routes()).toHaveLength(1);
  });
});

describe("@fastify/swagger", () => {
  /**
   * Подключить swagger, который дописывает описание всем операциям
   */
  const withSwagger = async (instance: FastifyInstance): Promise<void> => {
    await instance.register(swagger, {
      openapi: { info: { title: "Test", version: "1.0.0" } },
      transform: ({ schema, url }) => ({
        schema: {
          ...schema,
          description: schema?.description ?? `Swagger description of ${url}`,
        },
        url,
      }),
    });
  };

  it("берёт описание из swagger, когда его нет в схеме маршрута", async () => {
    const { client } = await start(
      (app) => {
        app.get("/plain", async () => ({}));
        app.get(
          "/described",
          { schema: { description: "Route description" } },
          async () => ({}),
        );
      },
      {},
      withSwagger,
    );
    const { tools } = await client.listTools();

    expect(tools.map((tool) => [tool.name, tool.description])).toEqual([
      ["get_plain", "Swagger description of /plain"],
      ["get_described", "Route description"],
    ]);
  });

  it("не читает swagger при swagger false", async () => {
    const { client } = await start(
      (app) => {
        app.get("/plain", async () => ({}));
      },
      { swagger: false },
      withSwagger,
    );
    const { tools } = await client.listTools();

    expect(tools[0]?.description).toBe("GET /plain");
  });

  it("не публикует маршруты самого swagger", async () => {
    const { app } = await start(
      (instance) => {
        instance.get("/plain", async () => ({}));
      },
      {},
      withSwagger,
    );

    expect(app.mcpRoutes.routes().map((route) => route.name)).toEqual([
      "get_plain",
    ]);
  });
});

describe("app.mcpRoutes", () => {
  it("считает маршруты и размер tools/list для обоих режимов", async () => {
    const { app } = await start((instance) => {
      instance.get("/a", async () => ({}));
      instance.get("/b", async () => ({}));
      instance.post("/c", async () => ({}));
    });
    const stats = app.mcpRoutes.stats();

    expect(stats.method).toBe("chars/4");
    expect(stats.routes).toEqual({ total: 3, exposed: 2, hidden: 1 });
    expect(stats.modes.tools.tools).toBe(2);
    expect(stats.modes.progressive.tools).toBe(3);
    expect(stats.modes.tools.tokens).toBe(
      Math.ceil(stats.modes.tools.chars / 4),
    );
    expect(stats.modes.progressive.tokens).toBe(
      Math.ceil(stats.modes.progressive.chars / 4),
    );
  });

  it("совпадает с реальным ответом tools/list по числу символов", async () => {
    const { app, client } = await start((instance) => {
      instance.get(
        "/clients/:id",
        { schema: { summary: "Get a client" } },
        async () => ({}),
      );
    });
    const { tools } = await client.listTools();

    expect(app.mcpRoutes.stats().modes.tools.chars).toBe(
      JSON.stringify(tools).length,
    );
  });

  it("отдаёт опубликованные маршруты с именами", async () => {
    const { app } = await start((instance) => {
      instance.get("/clients/:id", async () => ({}));
    });

    expect(app.mcpRoutes.routes()).toEqual([
      {
        name: "get_clients_by_id",
        method: "GET",
        url: "/clients/:id",
        description: "GET /clients/:id",
      },
    ]);
  });
});

describe("опции", () => {
  it.each([
    [{ endpoint: "mcp" }, 'The endpoint "mcp" must start with "/"'],
    [{ mode: "all" as never }, 'Unknown mode "all"'],
    [{ allow: ["FETCH /x"] }, 'Unknown HTTP method in rule "FETCH /x"'],
    [{ deny: ["clients"] }, 'must start with "/" or "*"'],
    [{ allow: "POST /clients" as never }, 'Option "allow" must be an array'],
    [{ deny: [1] as never }, 'Option "deny" must contain only strings'],
    [{ readOnly: "no" as never }, 'Option "readOnly" must be a boolean'],
    [{ allowedOrigins: "a.example" as never }, 'Option "allowedOrigins"'],
  ])("отклоняет неверные опции %j", async (options, message) => {
    await expect(createApp(options, () => undefined)).rejects.toThrow(message);
  });

  it("передаёт instructions и serverInfo в initialize", async () => {
    const { client } = await start(() => undefined, {
      instructions: "Use the tools to read the clients",
      serverInfo: { name: "clients-api", version: "9.9.9" },
    });

    expect(client.getServerVersion()).toMatchObject({
      name: "clients-api",
      version: "9.9.9",
    });
    expect(client.getInstructions()).toBe("Use the tools to read the clients");
  });
});
