import { ISwaggerMeta } from "@/types/routes";
import type { FastifyInstance } from "fastify";
import { toText, isPlainObject } from "@/utils/primitive";

/**
 * Читает summary и description из документа @fastify/swagger, если плагин зарегистрирован
 */
export class SwaggerService {
  private meta?: Map<string, ISwaggerMeta>;

  constructor(
    private readonly app: FastifyInstance,
    private readonly enabled: boolean,
  ) {}

  /**
   * Ключ карты, метод и путь в нотации OpenAPI
   */
  private key(method: string, path: string): string {
    return `${method.toUpperCase()} ${path.replace(/:([A-Za-z_]\w*)/g, "{$1}")}`;
  }

  /**
   * Построить карту операций из документа OpenAPI
   */
  private load(): Map<string, ISwaggerMeta> {
    const map = new Map<string, ISwaggerMeta>();
    const swagger: unknown = (this.app as { swagger?: unknown }).swagger;

    if (!this.enabled || typeof swagger !== "function") return map;

    try {
      const doc: unknown = swagger.call(this.app);
      const paths = isPlainObject(doc) ? doc.paths : undefined;

      for (const [path, item] of Object.entries(
        isPlainObject(paths) ? paths : {},
      )) {
        for (const [method, operation] of Object.entries(
          isPlainObject(item) ? item : {},
        )) {
          if (!isPlainObject(operation)) continue;

          map.set(this.key(method, path), {
            summary: toText(operation.summary),
            description: toText(operation.description),
            operationId: toText(operation.operationId),
          });
        }
      }
    } catch (error) {
      this.app.log.warn(
        { err: error },
        "fastify-mcp-routes could not read the @fastify/swagger document",
      );
    }

    return map;
  }

  /**
   * Сбросить кэш, документ строится заново при следующем обращении
   */
  reset(): void {
    this.meta = undefined;
  }

  /**
   * Найти метаданные операции по методу и шаблону URL
   */
  lookup(method: string, url: string): ISwaggerMeta | undefined {
    this.meta ??= this.load();

    return this.meta.get(this.key(method, url));
  }
}
