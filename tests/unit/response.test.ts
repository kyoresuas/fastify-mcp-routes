import { it, expect, describe } from "vitest";
import { toToolResult } from "@/helpers/response";

/**
 * Ответ маршрута для проверок
 */
const outcome = (
  status: number,
  payload: string,
  headers: Record<string, unknown> = { "content-type": "application/json" },
) => ({ status, payload, headers });

describe("результат инструмента", () => {
  it("отдаёт тело успешного ответа как есть", () => {
    expect(toToolResult("GET", outcome(200, '{"a":1}'))).toEqual({
      content: [{ type: "text", text: '{"a":1}' }],
    });
    expect(toToolResult("GET", outcome(201, "plain", {}))).toEqual({
      content: [{ type: "text", text: "plain" }],
    });
  });

  it("описывает пустое тело статусом", () => {
    expect(toToolResult("DELETE", outcome(204, ""))).toEqual({
      content: [{ type: "text", text: '{"status":204}' }],
    });
  });

  it("добавляет заголовки для HEAD и перенаправлений", () => {
    const head = toToolResult("HEAD", outcome(200, "", { etag: "x" }));
    const redirect = toToolResult("GET", outcome(302, "", { location: "/b" }));

    expect(head.content[0]).toEqual({
      type: "text",
      text: '{"status":200,"headers":{"etag":"x"}}',
    });
    expect(redirect.content[0]).toEqual({
      type: "text",
      text: '{"status":302,"headers":{"location":"/b"}}',
    });
    expect(redirect.isError).toBeUndefined();
  });

  it("убирает из заголовков date и connection", () => {
    const headers = {
      date: "Mon, 26 Oct 2026 08:48:10 GMT",
      Connection: "keep-alive",
      "content-length": "0",
      location: "/b",
    };
    const text = (status: number) => ({
      type: "text",
      text: `{"status":${status},"headers":{"content-length":"0","location":"/b"}}`,
    });

    expect(toToolResult("GET", outcome(302, "", headers)).content[0]).toEqual(
      text(302),
    );
    expect(toToolResult("HEAD", outcome(200, "", headers)).content[0]).toEqual(
      text(200),
    );
  });

  it("помечает 4xx и 5xx как ошибку и разбирает JSON-тело", () => {
    const result = toToolResult("GET", outcome(404, '{"message":"no"}'));

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      { type: "text", text: '{"status":404,"body":{"message":"no"}}' },
    ]);
    expect(toToolResult("GET", outcome(500, "oops", {})).content).toEqual([
      { type: "text", text: '{"status":500,"body":"oops"}' },
    ]);
  });
});
