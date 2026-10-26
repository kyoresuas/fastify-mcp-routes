import type { RouteOptions } from "fastify";
import { it, expect, describe } from "vitest";
import { RouteRegistryService } from "@/services/registry";

/**
 * Параметры маршрута в том виде, в каком их отдаёт хук onRoute
 */
const route = (options: Partial<RouteOptions>): RouteOptions =>
  ({
    url: "/a",
    method: "GET",
    handler: async () => ({}),
    ...options,
  }) as RouteOptions;

/**
 * Config маршрута с заведомо неверными типами полей
 */
const config = (value: unknown): RouteOptions["config"] =>
  value as RouteOptions["config"];

describe("сбор маршрутов", () => {
  it("читает схему, описание и config.mcp", () => {
    const registry = new RouteRegistryService();

    registry.add(
      route({
        url: "/clients/:id",
        schema: {
          summary: " Get ",
          operationId: "getClient",
          querystring: { type: "object" },
          hide: true,
        } as RouteOptions["schema"],
        config: { mcp: { name: "n", description: "d", hidden: true } },
      }),
    );

    expect(registry.list()).toEqual([
      {
        method: "GET",
        url: "/clients/:id",
        schema: {
          params: undefined,
          querystring: { type: "object" },
          body: undefined,
          summary: "Get",
          description: undefined,
          operationId: "getClient",
        },
        config: { name: "n", description: "d", hidden: true },
        hide: true,
      },
    ]);
  });

  it("принимает query как синоним querystring", () => {
    const registry = new RouteRegistryService();

    registry.add(
      route({
        schema: { query: { type: "object" } } as RouteOptions["schema"],
      }),
    );

    expect(registry.list()[0]?.schema.querystring).toEqual({ type: "object" });
  });

  it("пропускает схемы, которые не являются обычными объектами", () => {
    class ZodLike {
      type = "object";
    }

    const registry = new RouteRegistryService();

    registry.add(
      route({
        schema: { body: new ZodLike() } as unknown as RouteOptions["schema"],
      }),
    );

    expect(registry.list()[0]?.schema.body).toBeUndefined();
  });

  it("раскладывает несколько методов и убирает автоматический HEAD", () => {
    const registry = new RouteRegistryService();

    registry.add(route({ url: "/a", method: ["GET", "DELETE"] }));
    registry.add(route({ url: "/a", method: "HEAD" }));
    registry.add(route({ url: "/b", method: "head" as "HEAD" }));

    expect(registry.list().map((item) => `${item.method} ${item.url}`)).toEqual(
      ["GET /a", "DELETE /a", "HEAD /b"],
    );
  });

  it("отбрасывает config.mcp неверного типа", () => {
    const registry = new RouteRegistryService();

    registry.add(route({ config: config({ mcp: "yes" }) }));
    registry.add(
      route({ url: "/b", config: config({ mcp: { name: 5, hidden: "x" } }) }),
    );

    expect(registry.list().map((item) => item.config)).toEqual([
      {},
      { name: undefined, description: undefined, hidden: false },
    ]);
  });
});
