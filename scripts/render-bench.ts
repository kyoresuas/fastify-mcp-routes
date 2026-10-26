import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

// Команда, чей вывод попадает на картинку
const COMMAND = "npm run bench";

// Файл картинки относительно корня репозитория
const OUTPUT = join("docs", "bench.svg");

// Размеры окна в пикселях, ширина символа 0.6 от размера шрифта
const FONT_SIZE = 13;
const CHAR_WIDTH = 7.8;
const LINE_HEIGHT = 22;
const PAD_X = 24;
const PAD_Y = 20;
const TITLE_HEIGHT = 38;

// Пробелов между столбцами таблицы
const COLUMN_GAP = 4;

// Столбцы таблицы bench с цветами: размер progressive зелёным, отношение синим
const GREEN_COLUMNS = [3, 4];
const BLUE_COLUMNS = [5];

/**
 * Экранировать текст для XML
 */
const escapeXml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Запустить команду из корня репозитория и вернуть её настоящий вывод
 */
const runCommand = (root: string): string =>
  execFileSync("npm", ["run", "bench"], { cwd: root, encoding: "utf8" });

/**
 * Один фрагмент строки терминала, координаты задаются в символах
 */
const piece = (
  column: number,
  row: number,
  className: string,
  text: string,
): string =>
  `<text class="${className}" x="${(PAD_X + column * CHAR_WIDTH).toFixed(1)}" y="${
    TITLE_HEIGHT + PAD_Y + row * LINE_HEIGHT + FONT_SIZE
  }">${escapeXml(text)}</text>`;

/**
 * Цвет ячейки таблицы по номеру столбца
 */
const cellClass = (index: number, header: boolean): string => {
  if (header) return "h";
  if (GREEN_COLUMNS.includes(index)) return "g";

  return BLUE_COLUMNS.includes(index) ? "b" : "t";
};

/**
 * Разобрать строки таблицы markdown на ячейки, строка-разделитель пропускается
 */
const parseTable = (lines: string[]): string[][] =>
  lines
    .filter((line) => line.startsWith("|") && !/^\|[\s:|-]+\|$/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

/**
 * Собрать SVG терминального окна с командой и таблицей, выровненной по столбцам
 */
const renderSvg = (output: string): string => {
  const rows = parseTable(output.replace(/\n+$/, "").split("\n"));
  const widths = (rows[0] ?? []).map((_, index) =>
    Math.max(...rows.map((row) => (row[index] ?? "").length)),
  );
  const starts = widths.map((_, index) =>
    widths.slice(0, index).reduce((sum, item) => sum + item + COLUMN_GAP, 0),
  );
  const columns = Math.max(
    COMMAND.length + 2,
    widths.reduce((sum, item) => sum + item + COLUMN_GAP, -COLUMN_GAP),
  );
  const width = Math.ceil(PAD_X * 2 + columns * CHAR_WIDTH);
  const height = TITLE_HEIGHT + PAD_Y * 2 + (rows.length + 3) * LINE_HEIGHT;
  // Линия под заголовком таблицы занимает отдельную строку терминала
  const ruleY = TITLE_HEIGHT + PAD_Y + 3.5 * LINE_HEIGHT - 3;
  const body = [
    piece(0, 0, "g", "$"),
    piece(2, 0, "t", COMMAND),
    ...rows.flatMap((row, rowIndex) =>
      row.map((cell, index) =>
        piece(
          (starts[index] ?? 0) + (widths[index] ?? 0) - cell.length,
          rowIndex === 0 ? 2 : rowIndex + 3,
          cellClass(index, rowIndex === 0),
          cell,
        ),
      ),
    ),
  ];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Output of ${COMMAND}</title>
  <desc id="desc">${escapeXml(output.replace(/\n+$/, ""))}</desc>
  <style>
    text { font: ${FONT_SIZE}px ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; white-space: pre; }
    .win { fill: #f6f8fa; stroke: #d0d7de; }
    .bar { fill: #eaeef2; }
    .rule { stroke: #d0d7de; }
    .t { fill: #1f2328; }
    .h { fill: #59636e; font-weight: 700; }
    .g { fill: #1a7f37; }
    .b { fill: #0969da; }
    @media (prefers-color-scheme: dark) {
      .win { fill: #0d1117; stroke: #30363d; }
      .bar { fill: #161b22; }
      .rule { stroke: #30363d; }
      .t { fill: #e6edf3; }
      .h { fill: #8b949e; }
      .g { fill: #3fb950; }
      .b { fill: #79c0ff; }
    }
  </style>
  <rect class="win" x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="10"/>
  <path class="bar" d="M0.5 ${TITLE_HEIGHT}V10.5a10 10 0 0 1 10-10h${width - 21}a10 10 0 0 1 10 10V${TITLE_HEIGHT}z"/>
  <circle cx="22" cy="${TITLE_HEIGHT / 2}" r="6" fill="#ff5f57"/>
  <circle cx="42" cy="${TITLE_HEIGHT / 2}" r="6" fill="#febc2e"/>
  <circle cx="62" cy="${TITLE_HEIGHT / 2}" r="6" fill="#28c840"/>
  <line class="rule" x1="${PAD_X}" y1="${ruleY}" x2="${width - PAD_X}" y2="${ruleY}"/>
  ${body.join("\n  ")}
</svg>
`;
};

/**
 * Запустить npm run bench и записать его вывод в docs/bench.svg
 */
const bootstrap = (): void => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const file = join(root, OUTPUT);

  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderSvg(runCommand(root)));
  process.stdout.write(`${OUTPUT} written\n`);
};

try {
  bootstrap();
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`);
  process.exit(1);
}
