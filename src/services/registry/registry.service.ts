import type { RouteOptions } from "fastify";
import { IMcpRouteConfig } from "@/types/options";
import { toText, isPlainObject } from "@/utils/primitive";
import { IRouteRecord, IRouteSchemaParts } from "@/types/routes";

/**
 * Собирает маршруты приложения из хука onRoute
 */
export class RouteRegistryService {
  private readonly records: IRouteRecord[] = [];

  /**
   * Взять схему как обычный объект, классы вроде zod-схем пропускаем
   */
  private plain(value: unknown): Record<string, unknown> | undefined {
    return isPlainObject(value) ? value : undefined;
  }

  /**
   * Прочитать config.mcp, неверные типы полей отбрасываем
   */
  private readConfig(route: RouteOptions): IMcpRouteConfig {
    const config: unknown = route.config;
    const raw = isPlainObject(config) ? config.mcp : undefined;

    if (!isPlainObject(raw)) return {};

    return {
      name: toText(raw.name),
      description: toText(raw.description),
      hidden: raw.hidden === true,
    };
  }

  /**
   * Выбрать из схемы маршрута то, что нужно для инструмента
   */
  private readSchema(route: RouteOptions): {
    parts: IRouteSchemaParts;
    hide: boolean;
  } {
    const schema = this.plain(route.schema) ?? {};

    return {
      hide: schema.hide === true,
      parts: {
        params: this.plain(schema.params),
        querystring: this.plain(schema.querystring ?? schema.query),
        body: this.plain(schema.body),
        summary: toText(schema.summary),
        description: toText(schema.description),
        operationId: toText(schema.operationId),
      },
    };
  }

  /**
   * Запомнить маршрут из хука onRoute, маршрут с несколькими методами раскладывается по записям
   */
  add(route: RouteOptions): void {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const { parts, hide } = this.readSchema(route);
    const config = this.readConfig(route);

    for (const method of methods) {
      this.records.push({
        method: String(method).toUpperCase(),
        url: route.url,
        schema: parts,
        config,
        hide,
      });
    }
  }

  /**
   * Все собранные маршруты. Автоматический HEAD к GET отбрасывается, он дублирует маршрут
   */
  list(): IRouteRecord[] {
    const getUrls = new Set(
      this.records.filter((r) => r.method === "GET").map((r) => r.url),
    );

    return this.records.filter(
      (record) => !(record.method === "HEAD" && getUrls.has(record.url)),
    );
  }
}
