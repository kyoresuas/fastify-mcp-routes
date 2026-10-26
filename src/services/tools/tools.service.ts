import { McpMode } from "@/types/shared";
import { IRouteDescriptor } from "@/types/routes";
import { CatalogService } from "@/services/catalog";
import type { Tool } from "@modelcontextprotocol/server";
import { ProgressiveContract } from "@/contracts/progressive";

/**
 * Собирает список инструментов для ответа tools/list
 */
export class ToolsService {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * Подсказки клиенту о побочных эффектах маршрута
   */
  private annotations(route: IRouteDescriptor): Tool["annotations"] {
    if (route.method === "GET" || route.method === "HEAD") {
      return { readOnlyHint: true };
    }

    if (route.method === "DELETE") return { destructiveHint: true };
    if (route.method === "PUT") return { idempotentHint: true };

    return undefined;
  }

  /**
   * Инструмент на каждый опубликованный маршрут
   */
  private routeTools(): Tool[] {
    return this.catalog.descriptors().map((route) => {
      const annotations = this.annotations(route);

      return {
        name: route.name,
        description: route.description,
        inputSchema: route.schema as Tool["inputSchema"],
        ...(annotations ? { annotations } : {}),
      };
    });
  }

  /**
   * Три мета-инструмента, их число не зависит от количества маршрутов
   */
  private metaTools(): Tool[] {
    return [
      {
        name: ProgressiveContract.SEARCH,
        description:
          "Find application routes by keywords. Returns route names, methods and URLs. Call it without a query to list routes.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Keywords to look for" },
            limit: {
              type: "integer",
              description: `Maximum routes to return, up to ${ProgressiveContract.MAX_LIMIT}`,
            },
          },
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: ProgressiveContract.DESCRIBE,
        description:
          "Get the input schema and details of one route returned by search_routes.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Route name" },
          },
          required: ["name"],
        },
        annotations: { readOnlyHint: true },
      },
      {
        name: ProgressiveContract.CALL,
        description:
          "Call a route by name. Pass the arguments described by describe_route.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Route name" },
            arguments: {
              type: "object",
              description: "Route arguments",
            },
          },
          required: ["name"],
        },
      },
    ];
  }

  /**
   * Список инструментов для выбранного режима
   */
  list(mode: McpMode): Tool[] {
    return mode === "progressive" ? this.metaTools() : this.routeTools();
  }
}
