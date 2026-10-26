import fp from "fastify-plugin";
import { ToolsService } from "@/services/tools";
import { StatsService } from "@/services/stats";
import type { FastifyPluginAsync } from "fastify";
import { PolicyService } from "@/services/policy";
import { ServerService } from "@/services/server";
import { resolveOptions } from "@/helpers/options";
import { CatalogService } from "@/services/catalog";
import { InvokerService } from "@/services/invoker";
import { SwaggerService } from "@/services/swagger";
import { IMcpRoutesOptions } from "@/types/options";
import { RouteRegistryService } from "@/services/registry";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, originValidation } from "@modelcontextprotocol/node";

// Схема эндпоинта, ключ hide прячет его из документации @fastify/swagger
const HIDDEN_SCHEMA: Record<string, unknown> = { hide: true };

/**
 * Подключает MCP к приложению, собирает маршруты через onRoute и отдаёт их по Streamable HTTP
 */
const plugin: FastifyPluginAsync<IMcpRoutesOptions> = async (app, raw) => {
  const options = resolveOptions(raw);
  const registry = new RouteRegistryService();
  const policy = new PolicyService(options);
  const swagger = new SwaggerService(app, options.swagger);
  const catalog = new CatalogService(app, registry, policy, swagger);
  const tools = new ToolsService(catalog);
  const stats = new StatsService(catalog, tools);
  const server = new ServerService(
    options,
    catalog,
    tools,
    new InvokerService(app),
  );
  const handler = createMcpHandler((ctx) => server.create(ctx), {
    onerror: (error) => app.log.debug({ err: error }, "MCP request rejected"),
  });
  const serve = toNodeHandler(handler, {
    onerror: (error) => app.log.error({ err: error }, "MCP handler failed"),
  });
  const validateOrigin = originValidation(options.allowedOrigins);

  // Эндпоинт регистрируется до хука onRoute, поэтому в список маршрутов он не попадает
  app.route({
    method: ["GET", "POST", "DELETE"],
    url: options.endpoint,
    exposeHeadRoute: false,
    schema: HIDDEN_SCHEMA,
    handler: async (request, reply) => {
      reply.hijack();

      if (!validateOrigin(request.raw, reply.raw)) return;

      await serve(request.raw, reply.raw, request.body);
    },
  });

  app.addHook("onRoute", (route) => registry.add(route));
  app.addHook("onReady", async () => {
    catalog.markReady();
    catalog.descriptors();
  });
  app.addHook("onClose", async () => handler.close());

  app.decorate("mcpRoutes", {
    stats: () => stats.collect(),
    routes: () => catalog.summaries(),
  });
};

/**
 * Плагин Fastify, превращающий маршруты приложения в инструменты MCP
 */
export const mcpRoutes = fp(plugin, {
  name: "fastify-mcp-routes",
  fastify: "5.x",
});
