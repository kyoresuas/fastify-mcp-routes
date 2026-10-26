import {
  IRequestParts,
  IInvokeOutcome,
  IRouteDescriptor,
} from "@/types/routes";
import { isPlainObject } from "@/utils/primitive";
import { fillPath, toQueryString } from "@/helpers/url";
import type { HTTPMethods, FastifyInstance } from "fastify";
import { errorResult, toToolResult } from "@/helpers/response";
import type { CallToolResult } from "@modelcontextprotocol/server";

/**
 * Вызывает маршрут приложения через app.inject, поэтому хуки, авторизация и валидация работают как обычно
 */
export class InvokerService {
  constructor(private readonly app: FastifyInstance) {}

  /**
   * Разложить аргументы инструмента по частям запроса
   */
  private split(
    route: IRouteDescriptor,
    args: Record<string, unknown>,
  ): IRequestParts {
    const parts: IRequestParts = { params: {}, query: {}, body: {} };

    for (const [name, value] of Object.entries(args)) {
      const binding = Object.hasOwn(route.bindings, name)
        ? route.bindings[name]
        : undefined;

      if (binding && value !== undefined) {
        parts[binding.target][binding.key] = value;
      }
    }

    return parts;
  }

  /**
   * Тело запроса, undefined если маршрут тело не принимает или аргумент не передан
   */
  private payloadOf(
    route: IRouteDescriptor,
    parts: IRequestParts,
  ): unknown | undefined {
    if (route.wholeBody) return parts.body["body"];

    const hasBody = Object.values(route.bindings).some(
      (binding) => binding.target === "body",
    );

    return hasBody ? parts.body : undefined;
  }

  /**
   * Выполнить запрос к маршруту и вернуть код, тело и заголовки ответа
   */
  private async send(
    route: IRouteDescriptor,
    parts: IRequestParts,
    headers: Record<string, string>,
  ): Promise<IInvokeOutcome> {
    const payload = this.payloadOf(route, parts);
    const response = await this.app.inject({
      url: `${fillPath(route.url, parts.params)}${toQueryString(parts.query)}`,
      method: route.method as HTTPMethods,
      headers: {
        accept: "application/json",
        ...(payload === undefined
          ? {}
          : { "content-type": "application/json" }),
        ...headers,
      },
      ...(payload === undefined ? {} : { payload: JSON.stringify(payload) }),
    });

    return {
      status: response.statusCode,
      payload: response.payload,
      headers: response.headers,
    };
  }

  /**
   * Вызвать маршрут с аргументами инструмента и заголовками исходного HTTP-запроса
   */
  async invoke(
    route: IRouteDescriptor,
    args: unknown,
    headers: Record<string, string>,
  ): Promise<CallToolResult> {
    const parts = this.split(route, isPlainObject(args) ? args : {});
    const missing = route.pathParams.find(
      (param) => !param.optional && parts.params[param.name] === undefined,
    );

    if (missing) return errorResult(`Missing path parameter "${missing.name}"`);

    try {
      return toToolResult(route.method, await this.send(route, parts, headers));
    } catch (error) {
      return errorResult(`Route call failed: ${(error as Error).message}`);
    }
  }
}
