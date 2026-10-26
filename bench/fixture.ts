import Fastify from "fastify";
import { mcpRoutes } from "@/index";
import type { FastifyInstance } from "fastify";
import { IMcpRoutesOptions } from "@/types/options";

// Ресурсы, из которых строятся маршруты фикстуры
const RESOURCES = [
  "clients",
  "orders",
  "invoices",
  "products",
  "tickets",
  "users",
  "projects",
  "tasks",
  "payments",
  "subscriptions",
  "reports",
  "comments",
  "files",
  "teams",
  "roles",
  "events",
  "webhooks",
  "tokens",
  "devices",
  "locations",
  "shipments",
  "returns",
  "coupons",
  "reviews",
  "categories",
  "brands",
  "warehouses",
  "suppliers",
  "contracts",
  "employees",
  "departments",
  "vehicles",
  "bookings",
  "messages",
  "notifications",
  "campaigns",
  "leads",
  "contacts",
  "documents",
  "accounts",
];

// Сколько маршрутов строится на один ресурс
export const ROUTES_PER_RESOURCE = 5;

// Самое большое число маршрутов, которое умеет строить фикстура
export const MAX_FIXTURE_ROUTES = RESOURCES.length * ROUTES_PER_RESOURCE;

const idParams = {
  type: "object",
  properties: { id: { type: "string", description: "Record id" } },
  required: ["id"],
};

/**
 * Зарегистрировать пять типовых маршрутов одного ресурса
 */
const addResource = (
  app: FastifyInstance,
  resource: string,
  limit: number,
): void => {
  const done = async () => ({ ok: true });
  const routes = [
    () =>
      app.get(
        `/${resource}`,
        {
          schema: {
            summary: `List ${resource}`,
            querystring: {
              type: "object",
              properties: {
                limit: { type: "integer", description: "Page size" },
                offset: { type: "integer", description: "Rows to skip" },
                search: { type: "string", description: "Text to look for" },
              },
            },
          },
        },
        done,
      ),
    () =>
      app.get(
        `/${resource}/:id`,
        {
          schema: {
            summary: `Get one of ${resource} by id`,
            params: idParams,
            querystring: {
              type: "object",
              properties: { expand: { type: "boolean" } },
            },
          },
        },
        done,
      ),
    () =>
      app.post(
        `/${resource}`,
        {
          schema: {
            summary: `Create one of ${resource}`,
            body: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
              },
              required: ["name"],
            },
          },
        },
        done,
      ),
    () =>
      app.put(
        `/${resource}/:id`,
        {
          schema: {
            summary: `Update one of ${resource}`,
            params: idParams,
            body: {
              type: "object",
              properties: {
                name: { type: "string" },
                description: { type: "string" },
                status: { type: "string", enum: ["active", "archived"] },
              },
            },
          },
        },
        done,
      ),
    () =>
      app.delete(
        `/${resource}/:id`,
        { schema: { summary: `Delete one of ${resource}`, params: idParams } },
        done,
      ),
  ];

  for (const register of routes.slice(0, limit)) register();
};

/**
 * Приложение с заданным числом типовых маршрутов, плагин регистрируется до маршрутов
 */
export const buildSyntheticApp = async (
  count: number,
  options: IMcpRoutesOptions = {},
): Promise<FastifyInstance> => {
  if (count < 1 || count > MAX_FIXTURE_ROUTES) {
    throw new Error(
      `Число маршрутов должно быть от 1 до ${MAX_FIXTURE_ROUTES}`,
    );
  }

  const app = Fastify();

  await app.register(mcpRoutes, options);

  for (let index = 0; index * ROUTES_PER_RESOURCE < count; index += 1) {
    const rest = count - index * ROUTES_PER_RESOURCE;

    addResource(app, RESOURCES[index]!, Math.min(rest, ROUTES_PER_RESOURCE));
  }

  await app.ready();

  return app;
};
