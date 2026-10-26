import {
  slugify,
  uniqueName,
  slugFromUrl,
  generateToolName,
  sanitizeToolName,
} from "@/helpers/naming";
import { it, expect, describe } from "vitest";

describe("имена инструментов", () => {
  it("приводит строку к snake_case", () => {
    expect(slugify("Get-Client  Info")).toBe("get_client_info");
    expect(slugify("__a__")).toBe("a");
  });

  it("собирает часть имени из URL", () => {
    expect(slugFromUrl("/clients")).toBe("clients");
    expect(slugFromUrl("/clients/:id/orders")).toBe("clients_by_id_orders");
    expect(slugFromUrl("/v1/users/:userId")).toBe("v1_users_by_userid");
    expect(slugFromUrl("/files/*")).toBe("files_wildcard");
    expect(slugFromUrl("/items/:id?")).toBe("items_by_id");
    expect(slugFromUrl("/n/:id(^\\d+$)")).toBe("n_by_id");
    expect(slugFromUrl("/")).toBe("root");
  });

  it("добавляет метод к имени", () => {
    expect(generateToolName("GET", "/clients/:id")).toBe("get_clients_by_id");
    expect(generateToolName("POST", "/")).toBe("post_root");
  });

  it("заменяет недопустимые символы и режет длинные имена", () => {
    expect(sanitizeToolName("find thing!")).toBe("find_thing_");
    expect(sanitizeToolName("a".repeat(100))).toHaveLength(64);
  });

  it("добавляет числовой суффикс к занятому имени", () => {
    const used = new Set(["get_a", "get_a_2"]);

    expect(uniqueName("get_b", used)).toBe("get_b");
    expect(uniqueName("get_a", used)).toBe("get_a_3");
  });

  it("не выходит за предел длины при добавлении суффикса", () => {
    const long = "a".repeat(64);
    const name = uniqueName(long, new Set([long]));

    expect(name).toHaveLength(64);
    expect(name.endsWith("_2")).toBe(true);
  });
});
