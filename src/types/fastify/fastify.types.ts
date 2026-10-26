import { IMcpStats } from "@/types/stats";
import { IRouteSummary } from "@/types/routes";
import { IMcpRouteConfig } from "@/types/options";

export interface IMcpRoutes {
  // Размер tools/list в токенах для обоих режимов
  stats: () => IMcpStats;
  // Опубликованные маршруты с именами инструментов
  routes: () => IRouteSummary[];
}

declare module "fastify" {
  interface FastifyInstance {
    mcpRoutes: IMcpRoutes;
  }

  interface FastifyContextConfig {
    mcp?: IMcpRouteConfig;
  }
}
