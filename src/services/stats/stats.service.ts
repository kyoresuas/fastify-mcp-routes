import { McpMode } from "@/types/shared";
import { McpContract } from "@/contracts/mcp";
import { ToolsService } from "@/services/tools";
import { CatalogService } from "@/services/catalog";
import { IMcpStats, IModeStats } from "@/types/stats";

/**
 * Оценивает размер ответа tools/list в токенах
 */
export class StatsService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly tools: ToolsService,
  ) {}

  /**
   * Размер списка инструментов одного режима, токены оцениваются как символы / 4 с округлением вверх
   */
  private measure(mode: McpMode): IModeStats {
    const tools = this.tools.list(mode);
    const chars = JSON.stringify(tools).length;

    return {
      tools: tools.length,
      chars,
      tokens: Math.ceil(chars / McpContract.CHARS_PER_TOKEN),
    };
  }

  /**
   * Размер tools/list для обоих режимов и число маршрутов
   */
  collect(): IMcpStats {
    const exposed = this.catalog.descriptors().length;
    const total = this.catalog.total();

    return {
      method: McpContract.ESTIMATE_METHOD,
      routes: { total, exposed, hidden: total - exposed },
      modes: {
        tools: this.measure("tools"),
        progressive: this.measure("progressive"),
      },
    };
  }
}
