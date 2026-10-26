import { unique } from "@/utils/primitive";
import { McpContract } from "@/contracts/mcp";
import { compileRule } from "@/helpers/rules";
import { readPackageVersion } from "@/utils/package";
import { IResolvedOptions, IMcpRoutesOptions } from "@/types/options";

/**
 * Назвать тип значения для текста ошибки
 */
const typeName = (value: unknown): string => {
  if (value === null) return "null";

  return Array.isArray(value) ? "array" : typeof value;
};

/**
 * Проверить, что опция это массив строк, для undefined вернуть пустой массив
 */
const stringList = (name: string, value: unknown, sample: string): string[] => {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throw new Error(
      `Option "${name}" must be an array of strings like "${sample}", got ${typeName(value)}`,
    );
  }

  const index = value.findIndex((item) => typeof item !== "string");

  if (index !== -1) {
    throw new Error(
      `Option "${name}" must contain only strings like "${sample}", got ${typeName(value[index])} at index ${index}`,
    );
  }

  return value as string[];
};

/**
 * Проверить опции плагина и подставить значения по умолчанию
 */
export const resolveOptions = (
  options: IMcpRoutesOptions = {},
): IResolvedOptions => {
  const endpoint = options.endpoint ?? McpContract.ENDPOINT;
  const mode = options.mode ?? "tools";
  const allow = stringList("allow", options.allow, "METHOD /path");
  const deny = stringList("deny", options.deny, "METHOD /path");
  const allowedOrigins = stringList(
    "allowedOrigins",
    options.allowedOrigins,
    "app.example",
  );

  if (!endpoint.startsWith("/")) {
    throw new Error(`The endpoint "${endpoint}" must start with "/"`);
  }

  if (mode !== "tools" && mode !== "progressive") {
    throw new Error(
      `Unknown mode "${String(mode)}", use "tools" or "progressive"`,
    );
  }

  if (options.readOnly !== undefined && typeof options.readOnly !== "boolean") {
    throw new Error(
      `Option "readOnly" must be a boolean, got ${typeName(options.readOnly)}`,
    );
  }

  return {
    endpoint,
    mode,
    readOnly: options.readOnly ?? true,
    allow: allow.map(compileRule),
    deny: deny.map(compileRule),
    forwardHeaders: unique(
      (options.forwardHeaders ?? McpContract.FORWARDED_HEADERS).map((name) =>
        name.toLowerCase(),
      ),
    ),
    allowedOrigins,
    swagger: options.swagger ?? true,
    serverName: options.serverInfo?.name ?? McpContract.SERVER_NAME,
    serverVersion: options.serverInfo?.version ?? readPackageVersion(),
    instructions: options.instructions,
  };
};
