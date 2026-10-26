import { it, expect, describe } from "vitest";
import { compileRule, matchesRule } from "@/helpers/rules";

/**
 * Проверить правило на паре метод и URL
 */
const hit = (rule: string, method: string, url: string): boolean =>
  matchesRule(compileRule(rule), { method, url });

describe("правила allow и deny", () => {
  it("сопоставляет метод и точный URL", () => {
    expect(hit("POST /clients", "POST", "/clients")).toBe(true);
    expect(hit("POST /clients", "GET", "/clients")).toBe(false);
    expect(hit("post /clients", "POST", "/clients")).toBe(true);
    expect(hit("POST /clients", "POST", "/clients/:id")).toBe(false);
  });

  it("понимает звёздочку в URL и в методе", () => {
    expect(hit("GET /internal/*", "GET", "/internal/stats")).toBe(true);
    expect(hit("GET /internal/*", "GET", "/internal/a/b")).toBe(true);
    expect(hit("GET /internal/*", "GET", "/public")).toBe(false);
    expect(hit("* /admin/*", "DELETE", "/admin/users")).toBe(true);
  });

  it("считает правило без метода правилом на любой метод", () => {
    expect(hit("/clients", "DELETE", "/clients")).toBe(true);
    expect(hit("*", "GET", "/anything")).toBe(true);
  });

  it("игнорирует косую черту в конце и сопоставляет корень", () => {
    expect(hit("GET /clients/", "GET", "/clients")).toBe(true);
    expect(hit("GET /clients", "GET", "/clients/")).toBe(true);
    expect(hit("GET /", "GET", "/")).toBe(true);
    expect(hit("GET /", "GET", "/a")).toBe(false);
  });

  it("не принимает точки и скобки в URL за регулярное выражение", () => {
    expect(hit("GET /a.b", "GET", "/axb")).toBe(false);
    expect(hit("GET /a.b", "GET", "/a.b")).toBe(true);
  });

  it("отклоняет неверные правила", () => {
    expect(() => compileRule("FETCH /x")).toThrow(/Unknown HTTP method/);
    expect(() => compileRule("GET clients")).toThrow(/must start with/);
  });
});
