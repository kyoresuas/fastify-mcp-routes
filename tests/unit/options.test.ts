import { it, expect, describe } from "vitest";
import { resolveOptions } from "@/helpers/options";
import type { IMcpRoutesOptions } from "@/types/options";

describe("проверка опций", () => {
  it("подставляет значения по умолчанию", () => {
    const options = resolveOptions({});

    expect(options.mode).toBe("tools");
    expect(options.readOnly).toBe(true);
    expect(options.allow).toEqual([]);
    expect(options.deny).toEqual([]);
    expect(options.allowedOrigins).toEqual([]);
  });

  it("принимает верные значения", () => {
    const options = resolveOptions({
      mode: "progressive",
      readOnly: false,
      allow: ["POST /clients"],
      deny: ["* /admin/*"],
      allowedOrigins: ["app.example"],
    });

    expect(options.mode).toBe("progressive");
    expect(options.readOnly).toBe(false);
    expect(options.allow).toHaveLength(1);
    expect(options.deny).toHaveLength(1);
    expect(options.allowedOrigins).toEqual(["app.example"]);
  });

  it.each([
    [
      { allow: "POST /a" },
      'Option "allow" must be an array of strings like "METHOD /path", got string',
    ],
    [
      { allow: null },
      'Option "allow" must be an array of strings like "METHOD /path", got null',
    ],
    [
      { allow: ["POST /a", 5] },
      'Option "allow" must contain only strings like "METHOD /path", got number at index 1',
    ],
    [
      { deny: { rule: "GET /a" } },
      'Option "deny" must be an array of strings like "METHOD /path", got object',
    ],
    [
      { deny: [["GET /a"]] },
      'Option "deny" must contain only strings like "METHOD /path", got array at index 0',
    ],
    [{ readOnly: "false" }, 'Option "readOnly" must be a boolean, got string'],
    [{ readOnly: null }, 'Option "readOnly" must be a boolean, got null'],
    [{ readOnly: 0 }, 'Option "readOnly" must be a boolean, got number'],
    [
      { allowedOrigins: "app.example" },
      'Option "allowedOrigins" must be an array of strings like "app.example", got string',
    ],
    [
      { allowedOrigins: ["app.example", undefined] },
      'Option "allowedOrigins" must contain only strings like "app.example", got undefined at index 1',
    ],
    [{ mode: "all" }, 'Unknown mode "all", use "tools" or "progressive"'],
    [{ mode: 1 }, 'Unknown mode "1", use "tools" or "progressive"'],
  ])("отклоняет %j с понятной ошибкой", (options, message) => {
    expect(() => resolveOptions(options as IMcpRoutesOptions)).toThrow(message);
  });

  it("отклоняет правило с неверным методом или URL", () => {
    expect(() => resolveOptions({ allow: ["FETCH /a"] })).toThrow(
      'Unknown HTTP method in rule "FETCH /a"',
    );
    expect(() => resolveOptions({ deny: ["clients"] })).toThrow(
      'must start with "/" or "*"',
    );
  });
});
