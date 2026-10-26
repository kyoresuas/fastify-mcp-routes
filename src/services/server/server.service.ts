import type {
  CallToolResult,
  McpRequestContext,
} from "@modelcontextprotocol/server";
import { ToolsService } from "@/services/tools";
import { IResolvedOptions } from "@/types/options";
import { CatalogService } from "@/services/catalog";
import { InvokerService } from "@/services/invoker";
import { Server } from "@modelcontextprotocol/server";
import { toText, isPlainObject } from "@/utils/primitive";
import { textResult, errorResult } from "@/helpers/response";
import { ProgressiveContract } from "@/contracts/progressive";

/**
 * Создаёт MCP-сервер на каждый HTTP-запрос, состояние между запросами не хранится
 */
export class ServerService {
  constructor(
    private readonly options: IResolvedOptions,
    private readonly catalog: CatalogService,
    private readonly tools: ToolsService,
    private readonly invoker: InvokerService,
  ) {}

  /**
   * Взять из HTTP-запроса к MCP заголовки, которые нужно передать маршруту
   */
  private forwardedHeaders(request?: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const name of this.options.forwardHeaders) {
      const value = request?.headers.get(name);

      if (value) headers[name] = value;
    }

    return headers;
  }

  /**
   * Ответ на неизвестное имя маршрута
   */
  private unknownRoute(name: string): CallToolResult {
    return errorResult(
      `Unknown route "${name}". Use ${ProgressiveContract.SEARCH} to find a route name.`,
    );
  }

  /**
   * Поиск маршрутов для режима progressive
   */
  private search(args: Record<string, unknown>): CallToolResult {
    const limit = Math.min(
      Math.max(
        Math.trunc(Number(args.limit)) || ProgressiveContract.DEFAULT_LIMIT,
        1,
      ),
      ProgressiveContract.MAX_LIMIT,
    );
    const matched = this.catalog.search(toText(args.query) ?? "");

    return textResult(
      JSON.stringify({
        matched: matched.length,
        routes: matched.slice(0, limit),
      }),
    );
  }

  /**
   * Описание одного маршрута для режима progressive
   */
  private describe(args: Record<string, unknown>): CallToolResult {
    const name = toText(args.name) ?? "";
    const route = this.catalog.find(name);

    if (!route) return this.unknownRoute(name);

    return textResult(
      JSON.stringify({
        name: route.name,
        method: route.method,
        url: route.url,
        description: route.description,
        inputSchema: route.schema,
      }),
    );
  }

  /**
   * Обработать вызов одного из трёх мета-инструментов
   */
  private async callMeta(
    tool: string,
    args: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<CallToolResult> {
    if (tool === ProgressiveContract.SEARCH) return this.search(args);
    if (tool === ProgressiveContract.DESCRIBE) return this.describe(args);
    if (tool !== ProgressiveContract.CALL) {
      return errorResult(`Unknown tool "${tool}"`);
    }

    const name = toText(args.name) ?? "";
    const route = this.catalog.find(name);

    if (!route) return this.unknownRoute(name);

    return this.invoker.invoke(route, args.arguments, headers);
  }

  /**
   * Обработать tools/call в текущем режиме
   */
  private async call(
    tool: string,
    args: unknown,
    headers: Record<string, string>,
  ): Promise<CallToolResult> {
    if (this.options.mode === "progressive") {
      return this.callMeta(tool, isPlainObject(args) ? args : {}, headers);
    }

    const route = this.catalog.find(tool);

    if (!route) return errorResult(`Unknown tool "${tool}"`);

    return this.invoker.invoke(route, args, headers);
  }

  /**
   * Собрать сервер для одного запроса с заголовками этого запроса
   */
  create(ctx: McpRequestContext): Server {
    const server = new Server(
      { name: this.options.serverName, version: this.options.serverVersion },
      {
        capabilities: { tools: {} },
        ...(this.options.instructions
          ? { instructions: this.options.instructions }
          : {}),
      },
    );
    const headers = this.forwardedHeaders(ctx.requestInfo);

    server.setRequestHandler("tools/list", async () => ({
      tools: this.tools.list(this.options.mode),
    }));
    server.setRequestHandler("tools/call", async (request) =>
      this.call(request.params.name, request.params.arguments, headers),
    );

    return server;
  }
}
