import {
  buildInput,
  inlineRefs,
  pathParamsOf,
  stripSchemaMeta,
} from "@/helpers/schema";
import {
  uniqueName,
  generateToolName,
  sanitizeToolName,
} from "@/helpers/naming";
import { JsonSchema } from "@/types/shared";
import type { FastifyInstance } from "fastify";
import { PolicyService } from "@/services/policy";
import { SwaggerService } from "@/services/swagger";
import { RouteRegistryService } from "@/services/registry";
import { IRouteRecord, IRouteSummary, IRouteDescriptor } from "@/types/routes";

/**
 * Превращает собранные маршруты в описания инструментов
 */
export class CatalogService {
  private snapshot?: IRouteDescriptor[];
  private ready = false;

  constructor(
    private readonly app: FastifyInstance,
    private readonly registry: RouteRegistryService,
    private readonly policy: PolicyService,
    private readonly swagger: SwaggerService,
  ) {}

  /**
   * Подобрать описание для модели, метаданные swagger заполняют только пропуски
   */
  private describe(record: IRouteRecord): string {
    const meta = this.swagger.lookup(record.method, record.url);

    return (
      record.config.description ??
      record.schema.description ??
      record.schema.summary ??
      meta?.description ??
      meta?.summary ??
      `${record.method} ${record.url}`
    );
  }

  /**
   * Раскрыть $ref в схемах маршрута на общие схемы приложения
   */
  private resolveSchemas(
    record: IRouteRecord,
    shared: Record<string, JsonSchema>,
  ): IRouteRecord {
    const resolve = (schema?: JsonSchema): JsonSchema | undefined =>
      schema && stripSchemaMeta(inlineRefs(schema, shared) as JsonSchema);

    return {
      ...record,
      schema: {
        ...record.schema,
        params: resolve(record.schema.params),
        querystring: resolve(record.schema.querystring),
        body: resolve(record.schema.body),
      },
    };
  }

  /**
   * Собрать описания всех опубликованных маршрутов с уникальными именами
   */
  private build(): IRouteDescriptor[] {
    const used = new Set<string>();
    const descriptors: IRouteDescriptor[] = [];
    const shared = this.app.getSchemas() as Record<string, JsonSchema>;

    for (const original of this.registry.list()) {
      if (!this.policy.isExposed(original)) continue;

      const record = this.resolveSchemas(original, shared);
      const meta = this.swagger.lookup(record.method, record.url);
      const preferred =
        record.config.name ??
        record.schema.operationId ??
        meta?.operationId ??
        generateToolName(record.method, record.url);
      const name = uniqueName(sanitizeToolName(preferred), used);
      const pathParams = pathParamsOf(record.url);

      used.add(name);
      descriptors.push({
        name,
        method: record.method,
        url: record.url,
        description: this.describe(record),
        pathParams,
        ...buildInput(record.method, pathParams, record.schema),
      });
    }

    return descriptors;
  }

  /**
   * Отметить, что все маршруты загружены и список можно запомнить
   */
  markReady(): void {
    this.swagger.reset();
    this.snapshot = undefined;
    this.ready = true;
  }

  /**
   * Описания опубликованных маршрутов, после загрузки приложения список строится один раз
   */
  descriptors(): IRouteDescriptor[] {
    if (this.snapshot) return this.snapshot;

    const built = this.build();

    if (this.ready) this.snapshot = built;

    return built;
  }

  /**
   * Сколько маршрутов найдено, включая закрытые политикой
   */
  total(): number {
    return this.registry.list().length;
  }

  /**
   * Найти описание маршрута по имени инструмента
   */
  find(name: string): IRouteDescriptor | undefined {
    return this.descriptors().find((descriptor) => descriptor.name === name);
  }

  /**
   * Краткие сведения об опубликованных маршрутах
   */
  summaries(): IRouteSummary[] {
    return this.descriptors().map(({ name, method, url, description }) => ({
      name,
      method,
      url,
      description,
    }));
  }

  /**
   * Найти маршруты по словам запроса, имя весит больше URL, URL больше описания
   */
  search(query: string): IRouteSummary[] {
    const words = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    const weight = (text: string, word: string, points: number): number =>
      text.toLowerCase().includes(word) ? points : 0;

    const scored = this.summaries().map((route) => ({
      route,
      score: words.reduce(
        (sum, word) =>
          sum +
          weight(route.name, word, 3) +
          weight(`${route.method} ${route.url}`, word, 2) +
          weight(route.description, word, 1),
        0,
      ),
    }));

    return scored
      .filter((item) => words.length === 0 || item.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.route.name.localeCompare(b.route.name),
      )
      .map((item) => item.route);
  }
}
