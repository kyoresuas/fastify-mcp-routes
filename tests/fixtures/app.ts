import Fastify from "fastify";
import { mcpRoutes } from "@/index";
import { IMcpRoutesOptions } from "@/types/options";
import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";

// Токен, который принимает маршрут с авторизацией
export const API_TOKEN = "test-token";

// Ключ, который принимает маршрут с авторизацией вместо токена
export const API_KEY = "test-key";

// Клиенты, с которых начинается каждый тест
const SEED = [
  { id: "1", name: "Alice", plan: "pro" },
  { id: "2", name: "Bob", plan: "free" },
];

/**
 * Проверка авторизации по Authorization или x-api-key
 */
const requireAuth = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const bearer = request.headers.authorization === `Bearer ${API_TOKEN}`;
  const key = request.headers["x-api-key"] === API_KEY;

  if (bearer || key) return;

  await reply
    .code(401)
    .send({ error: "Unauthorized", message: "Credentials are required" });
};

/**
 * Приложение на шести маршрутах, плагин регистрируется до маршрутов
 */
export const buildFixtureApp = async (
  options: IMcpRoutesOptions = {},
  prepare?: (app: FastifyInstance) => Promise<void>,
): Promise<FastifyInstance> => {
  const app = Fastify();
  const clients = SEED.map((client) => ({ ...client }));

  await prepare?.(app);
  await app.register(mcpRoutes, options);

  app.get(
    "/clients",
    {
      schema: {
        summary: "List clients",
        querystring: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, description: "Page size" },
          },
        },
      },
    },
    async (request) => {
      const { limit } = request.query as { limit?: number };

      return clients.slice(0, limit ?? clients.length);
    },
  );

  app.get(
    "/clients/:id",
    {
      schema: {
        summary: "Get a client by id",
        params: {
          type: "object",
          properties: { id: { type: "string", description: "Client id" } },
          required: ["id"],
        },
        querystring: {
          type: "object",
          properties: { expand: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { expand } = request.query as { expand?: boolean };
      const client = clients.find((item) => item.id === id);

      if (!client) return reply.code(404).send({ message: "Client not found" });

      return expand ? { ...client, expanded: true } : client;
    },
  );

  app.post(
    "/clients",
    {
      schema: {
        summary: "Create a client",
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            plan: { type: "string", enum: ["free", "pro"] },
          },
          required: ["name"],
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { name: string; plan?: string };
      const client = {
        id: String(clients.length + 1),
        name: body.name,
        plan: body.plan ?? "free",
      };

      clients.push(client);

      return reply.code(201).send(client);
    },
  );

  app.get(
    "/reports/summary",
    {
      preHandler: requireAuth,
      schema: { summary: "Report available to authorized callers only" },
    },
    async () => ({ clients: clients.length }),
  );

  app.get(
    "/errors/not-found",
    { schema: { summary: "Always answers 404" } },
    async (_request, reply) =>
      reply.code(404).send({ message: "Nothing here" }),
  );

  app.get(
    "/errors/crash",
    { schema: { summary: "Always answers 500" } },
    async () => {
      throw new Error("Boom");
    },
  );

  await app.ready();

  return app;
};
