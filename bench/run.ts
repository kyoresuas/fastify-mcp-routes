import { buildSyntheticApp } from "./fixture";

// Размеры фикстур, для которых строится таблица
const SIZES = [5, 50, 200];

/**
 * Собрать строку таблицы для приложения с заданным числом маршрутов
 */
const measure = async (count: number): Promise<string> => {
  const app = await buildSyntheticApp(count, { readOnly: false });
  const { modes, routes } = app.mcpRoutes.stats();

  await app.close();

  const ratio = (modes.tools.tokens / modes.progressive.tokens).toFixed(1);

  return `| ${routes.exposed} | ${modes.tools.tools} | ${modes.tools.tokens} | ${modes.progressive.tools} | ${modes.progressive.tokens} | ${ratio}x |`;
};

/**
 * Напечатать таблицу размера tools/list для режимов tools и progressive
 */
const bootstrap = async (): Promise<void> => {
  const rows: string[] = [];

  for (const count of SIZES) rows.push(await measure(count));

  process.stdout.write(
    [
      "| Routes | Tools mode, tools | Tools mode, tokens | Progressive, tools | Progressive, tokens | Ratio |",
      "| ---: | ---: | ---: | ---: | ---: | ---: |",
      ...rows,
      "",
    ].join("\n"),
  );
};

bootstrap().catch((error: Error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
