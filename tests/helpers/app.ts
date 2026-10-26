import Fastify from "fastify";
import { mcpRoutes } from "@/index";
import type { FastifyInstance } from "fastify";
import { IMcpRoutesOptions } from "@/types/options";

/**
 * Создать приложение, зарегистрировать плагин до маршрутов и добавить маршруты теста
 */
export const createApp = async (
  options: IMcpRoutesOptions,
  register: (app: FastifyInstance) => void | Promise<void>,
  prepare?: (app: FastifyInstance) => Promise<void>,
): Promise<FastifyInstance> => {
  const app = Fastify();

  await prepare?.(app);
  await app.register(mcpRoutes, options);
  await register(app);
  await app.ready();

  return app;
};
