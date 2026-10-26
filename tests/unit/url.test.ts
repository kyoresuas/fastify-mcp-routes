import { it, expect, describe } from "vitest";
import { fillPath, toQueryString } from "@/helpers/url";

describe("сборка URL", () => {
  it("подставляет параметры пути с кодированием", () => {
    expect(fillPath("/a/:id/b/:name", { id: "1 2", name: "x/y" })).toBe(
      "/a/1%202/b/x%2Fy",
    );
    expect(fillPath("/n/:id(^\\d+$)", { id: 5 })).toBe("/n/5");
  });

  it("пропускает необязательный параметр без значения", () => {
    expect(fillPath("/items/:id?", {})).toBe("/items/");
  });

  it("подставляет wildcard, сохраняя косые черты", () => {
    expect(fillPath("/files/*", { "*": "docs/a b.txt" })).toBe(
      "/files/docs/a%20b.txt",
    );
  });

  it("собирает строку запроса из скаляров, массивов и объектов", () => {
    expect(
      toQueryString({
        q: "x y",
        n: 3,
        on: false,
        tag: ["a", "b"],
        f: { a: 1 },
        skip: undefined,
        nil: null,
      }),
    ).toBe("?q=x+y&n=3&on=false&tag=a&tag=b&f=%7B%22a%22%3A1%7D");
    expect(toQueryString({})).toBe("");
  });
});
