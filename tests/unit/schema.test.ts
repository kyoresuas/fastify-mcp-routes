import { it, expect, describe } from "vitest";
import { buildInput, inlineRefs, pathParamsOf } from "@/helpers/schema";

describe("параметры пути", () => {
  it("находит обычные, необязательные и wildcard-параметры", () => {
    expect(pathParamsOf("/a/:id/b/:name?")).toEqual([
      { name: "id", optional: false },
      { name: "name", optional: true },
    ]);
    expect(pathParamsOf("/files/*")).toEqual([{ name: "*", optional: false }]);
    expect(pathParamsOf("/n/:id(^\\d+$)")).toEqual([
      { name: "id", optional: false },
    ]);
    expect(pathParamsOf("/plain")).toEqual([]);
  });
});

describe("раскрытие $ref", () => {
  const shared = {
    Item: {
      $id: "Item",
      type: "object",
      properties: { n: { type: "integer" } },
    },
    Loop: {
      $id: "Loop",
      type: "object",
      properties: { next: { $ref: "Loop#" } },
    },
  };

  it("подставляет общую схему и убирает её $id", () => {
    expect(
      inlineRefs({ type: "array", items: { $ref: "Item#" } }, shared),
    ).toEqual({
      type: "array",
      items: { type: "object", properties: { n: { type: "integer" } } },
    });
  });

  it("идёт по JSON Pointer и по локальным ссылкам", () => {
    expect(inlineRefs({ $ref: "Item#/properties/n" }, shared)).toEqual({
      type: "integer",
    });
    expect(
      inlineRefs(
        {
          definitions: { s: { type: "string" } },
          properties: { a: { $ref: "#/definitions/s" } },
        },
        {},
      ),
    ).toEqual({
      definitions: { s: { type: "string" } },
      properties: { a: { type: "string" } },
    });
  });

  it("не зацикливается на рекурсивной схеме", () => {
    const result = JSON.stringify(inlineRefs({ $ref: "Loop#" }, shared));

    expect(result.length).toBeLessThan(2000);
    expect(result).not.toContain("$ref");
  });

  it("оставляет описание рядом со ссылкой и отбрасывает неразрешимую ссылку", () => {
    expect(
      inlineRefs({ $ref: "Item#", description: "d" }, shared),
    ).toMatchObject({
      type: "object",
      description: "d",
    });
    expect(inlineRefs({ $ref: "Missing#", description: "d" }, shared)).toEqual({
      description: "d",
    });
  });
});

describe("схема входа инструмента", () => {
  it("объединяет params, query и body в плоский объект", () => {
    const input = buildInput("PUT", [{ name: "id", optional: false }], {
      params: { type: "object", properties: { id: { type: "string" } } },
      querystring: {
        type: "object",
        properties: { dry: { type: "boolean" } },
        required: ["dry"],
      },
      body: {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
      },
    });

    expect(input.schema).toEqual({
      type: "object",
      properties: {
        id: { type: "string" },
        dry: { type: "boolean" },
        title: { type: "string" },
      },
      required: ["id", "dry", "title"],
    });
    expect(input.bindings).toEqual({
      id: { target: "params", key: "id" },
      dry: { target: "query", key: "dry" },
      title: { target: "body", key: "title" },
    });
    expect(input.wholeBody).toBe(false);
  });

  it("переименовывает совпавшие имена по части запроса", () => {
    const input = buildInput("POST", [], {
      querystring: { type: "object", properties: { id: { type: "string" } } },
      body: {
        type: "object",
        properties: { id: { type: "integer" }, query_id: { type: "string" } },
      },
    });

    expect(Object.keys(input.schema.properties as object)).toEqual([
      "id",
      "body_id",
      "query_id",
    ]);
    expect(input.bindings["body_id"]).toEqual({ target: "body", key: "id" });
  });

  it("не путает имена из прототипа объекта с занятыми", () => {
    const input = buildInput(
      "GET",
      [{ name: "constructor", optional: false }],
      {
        querystring: {
          type: "object",
          properties: { toString: { type: "string" } },
        },
      },
    );

    expect(Object.keys(input.schema.properties as object)).toEqual([
      "constructor",
      "toString",
    ]);
  });

  it("не требует необязательный параметр и пустую схему", () => {
    const input = buildInput("GET", [{ name: "id", optional: true }], {});

    expect(input.schema).toEqual({
      type: "object",
      properties: { id: { type: "string" } },
    });
  });

  it("добавляет аргумент body для POST без схемы тела", () => {
    const input = buildInput("POST", [], {});

    expect(input.wholeBody).toBe(true);
    expect(input.bindings["body"]).toEqual({ target: "body", key: "body" });
    expect(buildInput("GET", [], {}).bindings).toEqual({});
  });

  it("передаёт тело необъектной схемы одним обязательным аргументом", () => {
    const input = buildInput("POST", [], { body: { type: "array" } });

    expect(input.wholeBody).toBe(true);
    expect(input.schema).toEqual({
      type: "object",
      properties: { body: { type: "array" } },
      required: ["body"],
    });
  });
});
