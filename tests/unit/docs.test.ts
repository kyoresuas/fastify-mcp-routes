import { readFileSync } from "node:fs";
import { it, expect, describe } from "vitest";
import { execFileSync } from "node:child_process";

// Переводы README, в обоих должна быть картинка и верная команда claude mcp add
const READMES = ["README.md", "README_RU.md"];

// Сколько символов от начала README отводится первому экрану
const FIRST_SCREEN = 1500;

/**
 * Прочитать файл из корня репозитория
 */
const read = (name: string): string =>
  readFileSync(new URL(`../../${name}`, import.meta.url), "utf8");

/**
 * Строки таблицы из вывода bench, то есть всё, что начинается с вертикальной черты
 */
const tableOf = (text: string): string[] =>
  text.split("\n").filter((line) => line.startsWith("|"));

describe("документация", () => {
  it.each(READMES)("%s: картинка стоит на первом экране", (name) => {
    const text = read(name);
    const index = text.indexOf("](docs/bench.svg)");

    expect(index).toBeGreaterThan(0);
    expect(index).toBeLessThan(FIRST_SCREEN);
  });

  it("docs/bench.svg совпадает с настоящим выводом bench", () => {
    const svg = read("docs/bench.svg");
    const desc = /<desc id="desc">([\s\S]*?)<\/desc>/.exec(svg)?.[1] ?? "";
    const shown = tableOf(desc.replace(/&gt;/g, ">"));
    // Тот же прогон, что делает npm run bench, но без заголовка npm
    const real = tableOf(
      execFileSync(
        process.execPath,
        ["node_modules/tsx/dist/cli.mjs", "bench/run.ts"],
        { encoding: "utf8" },
      ),
    );

    expect(real).toHaveLength(5);
    expect(shown).toEqual(real);
    // Видимый текст картинки, а не только её описание, состоит из ячеек этих строк
    for (const line of real.filter((item) => !item.includes("---"))) {
      for (const cell of line.split("|").slice(1, -1)) {
        expect(svg).toContain(`>${cell.trim()}</text>`);
      }
    }
  });

  it.each(READMES)("%s: claude mcp add указывает область", (name) => {
    const commands = read(name)
      .split("\n")
      .filter((line) => line.startsWith("claude mcp add"));
    const withHeader = commands.filter((line) => line.includes("--header"));
    const plain = commands.filter((line) => !line.includes("--header"));

    // Область project пишет в .mcp.json, который коммитят, поэтому токен идёт только в local
    expect(plain.length).toBeGreaterThan(0);
    expect(withHeader.length).toBeGreaterThan(0);
    for (const line of plain) expect(line).toContain(" -s project ");
    for (const line of withHeader) expect(line).toContain(" -s local ");
  });
});
