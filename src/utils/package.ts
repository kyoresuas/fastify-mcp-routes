import { readFileSync } from "node:fs";
import { toText, parseJson, isPlainObject } from "@/utils/primitive";

/**
 * Прочитать версию пакета из package.json рядом с собранным кодом
 */
export const readPackageVersion = (): string => {
  const path = new URL("../../package.json", import.meta.url);

  try {
    const json = parseJson(readFileSync(path, "utf8"));

    return (isPlainObject(json) && toText(json.version)) || "0.0.0";
  } catch {
    return "0.0.0";
  }
};
