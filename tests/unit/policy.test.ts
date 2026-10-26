import { compileRule } from "@/helpers/rules";
import { IRouteRecord } from "@/types/routes";
import { it, expect, describe } from "vitest";
import { PolicyService } from "@/services/policy";

/**
 * Маршрут для проверок
 */
const route = (
  method: string,
  url: string,
  extra: Partial<IRouteRecord> = {},
): IRouteRecord => ({
  method,
  url,
  schema: {},
  config: {},
  hide: false,
  ...extra,
});

/**
 * Политика с правилами из строк
 */
const policy = (
  options: { readOnly?: boolean; allow?: string[]; deny?: string[] } = {},
) =>
  new PolicyService({
    readOnly: options.readOnly ?? true,
    allow: (options.allow ?? []).map(compileRule),
    deny: (options.deny ?? []).map(compileRule),
  });

describe("политика публикации", () => {
  it("по умолчанию открывает только GET и HEAD", () => {
    const rules = policy();

    expect(rules.isExposed(route("GET", "/a"))).toBe(true);
    expect(rules.isExposed(route("HEAD", "/a"))).toBe(true);
    expect(rules.isExposed(route("POST", "/a"))).toBe(false);
    expect(rules.isExposed(route("DELETE", "/a"))).toBe(false);
  });

  it("открывает мутации через allow", () => {
    expect(policy({ allow: ["POST /a"] }).isExposed(route("POST", "/a"))).toBe(
      true,
    );
    expect(policy({ allow: ["POST /a"] }).isExposed(route("POST", "/b"))).toBe(
      false,
    );
  });

  it("открывает всё при readOnly false, кроме OPTIONS", () => {
    const rules = policy({ readOnly: false });

    expect(rules.isExposed(route("DELETE", "/a"))).toBe(true);
    expect(rules.isExposed(route("OPTIONS", "/a"))).toBe(false);
  });

  it("закрывает маршрут через deny сильнее, чем открывает allow", () => {
    const rules = policy({ allow: ["POST /a"], deny: ["POST /a", "GET /x/*"] });

    expect(rules.isExposed(route("POST", "/a"))).toBe(false);
    expect(rules.isExposed(route("GET", "/x/y"))).toBe(false);
    expect(rules.isExposed(route("GET", "/z"))).toBe(true);
  });

  it("закрывает скрытые маршруты, даже если они разрешены", () => {
    const rules = policy({ allow: ["POST /a"] });

    expect(rules.isExposed(route("GET", "/a", { hide: true }))).toBe(false);
    expect(
      rules.isExposed(route("POST", "/a", { config: { hidden: true } })),
    ).toBe(false);
  });
});
