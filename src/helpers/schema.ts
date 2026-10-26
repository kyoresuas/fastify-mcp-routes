import {
  IPathParam,
  IArgBinding,
  IRouteInput,
  IRouteSchemaParts,
} from "@/types/routes";
import { McpContract } from "@/contracts/mcp";
import { isPlainObject } from "@/utils/primitive";
import { ArgTarget, JsonSchema } from "@/types/shared";

// Максимальная глубина раскрытия $ref, защита от циклических схем
const MAX_REF_DEPTH = 8;

/**
 * Найти параметры пути в шаблоне URL
 */
export const pathParamsOf = (url: string): IPathParam[] => {
  const params: IPathParam[] = [];

  for (const match of url.matchAll(/:([A-Za-z_]\w*)(?:\([^)]*\))?(\?)?/g)) {
    params.push({ name: match[1]!, optional: match[2] === "?" });
  }

  if (url.includes("*")) params.push({ name: "*", optional: false });

  return params;
};

/**
 * Достать узел схемы по JSON Pointer
 */
const pointer = (root: unknown, path: string): unknown => {
  let node = root;

  for (const raw of path.split("/").filter(Boolean)) {
    const key = decodeURIComponent(raw).replace(/~1/g, "/").replace(/~0/g, "~");

    if (typeof node !== "object" || node === null) return undefined;

    node = (node as Record<string, unknown>)[key];
  }

  return node;
};

/**
 * Найти схему, на которую указывает $ref, среди общих схем приложения
 */
const resolveRef = (
  ref: string,
  shared: Record<string, JsonSchema>,
  root: unknown,
): { node: unknown; root: unknown } | undefined => {
  const [id = "", fragment = ""] = ref.split("#");
  const doc = id ? shared[id] : root;

  if (doc === undefined) return undefined;

  const node = fragment ? pointer(doc, fragment) : doc;

  return node === undefined ? undefined : { node, root: doc };
};

/**
 * Раскрыть $ref на общие схемы приложения, чтобы inputSchema был самодостаточным
 */
export const inlineRefs = (
  node: unknown,
  shared: Record<string, JsonSchema>,
  root: unknown = node,
  depth = 0,
): unknown => {
  if (Array.isArray(node)) {
    return node.map((item) => inlineRefs(item, shared, root, depth));
  }

  if (!isPlainObject(node)) return node;

  const entries = Object.entries(node).filter(([key]) => key !== "$ref");
  const siblings = Object.fromEntries(
    entries.map(([key, value]) => [
      key,
      inlineRefs(value, shared, root, depth),
    ]),
  );

  if (typeof node.$ref !== "string") return siblings;

  const target = resolveRef(node.$ref, shared, root);

  if (!target || depth >= MAX_REF_DEPTH) return siblings;

  const resolved = inlineRefs(target.node, shared, target.root, depth + 1);

  return isPlainObject(resolved)
    ? { ...stripSchemaMeta(resolved), ...siblings }
    : siblings;
};

/**
 * Убрать из схемы служебные ключи идентификации
 */
export const stripSchemaMeta = (schema: JsonSchema): JsonSchema =>
  Object.fromEntries(
    Object.entries(schema).filter(
      ([key]) => key !== "$id" && key !== "$schema",
    ),
  );

/**
 * Свойства и обязательные поля объектной схемы, или undefined для других схем
 */
const fieldsOf = (
  schema: JsonSchema | undefined,
): { properties: Record<string, unknown>; required: string[] } | undefined => {
  if (!schema || !isPlainObject(schema.properties)) return undefined;

  const required = Array.isArray(schema.required)
    ? schema.required.filter((key): key is string => typeof key === "string")
    : [];

  return { properties: schema.properties, required };
};

/**
 * Собрать inputSchema инструмента из params, querystring и body маршрута
 */
export const buildInput = (
  method: string,
  pathParams: IPathParam[],
  parts: IRouteSchemaParts,
): IRouteInput => {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const bindings: Record<string, IArgBinding> = {};
  let wholeBody = false;

  // При совпадении имён поздний источник получает префикс с именем части запроса
  const add = (
    target: ArgTarget,
    key: string,
    schema: unknown,
    isRequired: boolean,
    preferred = key,
  ): void => {
    let name = preferred;
    let index = 2;

    if (Object.hasOwn(properties, name)) name = `${target}_${key}`;

    while (Object.hasOwn(properties, name)) {
      name = `${target}_${key}_${index++}`;
    }

    // Ключ __proto__ пропускаем, иначе присваивание подменит прототип объекта
    if (name === "__proto__") return;

    properties[name] = schema;
    bindings[name] = { target, key };

    if (isRequired) required.push(name);
  };

  const params = fieldsOf(parts.params);

  for (const [key, schema] of Object.entries(params?.properties ?? {})) {
    if (pathParams.some((param) => param.name === key)) {
      add(
        "params",
        key,
        schema,
        !pathParams.find((p) => p.name === key)!.optional,
      );
    }
  }

  for (const param of pathParams) {
    if (Object.hasOwn(params?.properties ?? {}, param.name)) continue;

    if (param.name === "*") {
      add(
        "params",
        "*",
        { type: "string", description: "Path matched by the wildcard" },
        true,
        McpContract.WILDCARD_ARGUMENT,
      );
      continue;
    }

    add("params", param.name, { type: "string" }, !param.optional);
  }

  const query = fieldsOf(parts.querystring);

  for (const [key, schema] of Object.entries(query?.properties ?? {})) {
    add("query", key, schema, query!.required.includes(key));
  }

  const hasBodySchema = parts.body !== undefined;
  const body = fieldsOf(parts.body);

  if (body) {
    for (const [key, schema] of Object.entries(body.properties)) {
      add("body", key, schema, body.required.includes(key));
    }
  } else if (hasBodySchema) {
    wholeBody = true;
    add("body", McpContract.BODY_ARGUMENT, parts.body, true);
  } else if ((McpContract.BODY_METHODS as readonly string[]).includes(method)) {
    wholeBody = true;
    add(
      "body",
      McpContract.BODY_ARGUMENT,
      { type: "object", description: "JSON request body" },
      false,
    );
  }

  return {
    schema: {
      type: "object",
      properties,
      ...(required.length > 0 ? { required } : {}),
    },
    bindings,
    wholeBody,
  };
};
