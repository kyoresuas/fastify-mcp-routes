import { McpContract } from "@/contracts/mcp";
import { matchesRule } from "@/helpers/rules";
import { IRouteRecord } from "@/types/routes";
import { IResolvedOptions } from "@/types/options";

/**
 * Решает, какие маршруты приложения попадают в MCP
 */
export class PolicyService {
  constructor(
    private readonly options: Pick<
      IResolvedOptions,
      "readOnly" | "allow" | "deny"
    >,
  ) {}

  /**
   * Попадает ли маршрут в MCP. Закрытие сильнее открытия, поэтому deny проверяется первым
   */
  isExposed(route: IRouteRecord): boolean {
    if (route.hide || route.config.hidden) return false;
    if (
      (McpContract.SKIPPED_METHODS as readonly string[]).includes(route.method)
    ) {
      return false;
    }

    if (this.options.deny.some((rule) => matchesRule(rule, route)))
      return false;
    if (this.options.allow.some((rule) => matchesRule(rule, route)))
      return true;

    return (
      !this.options.readOnly ||
      (McpContract.SAFE_METHODS as readonly string[]).includes(route.method)
    );
  }
}
