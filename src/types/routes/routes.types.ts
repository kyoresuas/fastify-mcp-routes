import { IMcpRouteConfig } from "@/types/options";
import { ArgTarget, JsonSchema } from "@/types/shared";

export interface IRouteSchemaParts {
  // Схема параметров пути
  params?: JsonSchema;
  // Схема строки запроса
  querystring?: JsonSchema;
  // Схема тела запроса
  body?: JsonSchema;
  // Краткое описание маршрута
  summary?: string;
  // Подробное описание маршрута
  description?: string;
  // Идентификатор операции
  operationId?: string;
}

export interface IRouteRecord {
  // HTTP-метод в верхнем регистре
  method: string;
  // Шаблон URL вместе с префиксом
  url: string;
  // Части схемы маршрута
  schema: IRouteSchemaParts;
  // Настройки config.mcp
  config: IMcpRouteConfig;
  // Маршрут скрыт через schema.hide
  hide: boolean;
}

export interface IArgBinding {
  // Часть запроса, в которую уходит аргумент
  target: ArgTarget;
  // Имя поля внутри этой части
  key: string;
}

export interface IPathParam {
  // Имя параметра в шаблоне URL
  name: string;
  // Параметр можно не передавать
  optional: boolean;
}

export interface IRouteInput {
  // inputSchema инструмента
  schema: JsonSchema;
  // Куда уходит каждый аргумент
  bindings: Record<string, IArgBinding>;
  // Тело передаётся одним аргументом body
  wholeBody: boolean;
}

export interface IRouteDescriptor extends IRouteInput {
  // Имя инструмента
  name: string;
  // HTTP-метод в верхнем регистре
  method: string;
  // Шаблон URL вместе с префиксом
  url: string;
  // Описание для модели
  description: string;
  // Параметры пути в порядке появления
  pathParams: IPathParam[];
}

export interface IRouteSummary {
  // Имя инструмента
  name: string;
  // HTTP-метод в верхнем регистре
  method: string;
  // Шаблон URL вместе с префиксом
  url: string;
  // Описание для модели
  description: string;
}

export interface ISwaggerMeta {
  // Краткое описание из OpenAPI
  summary?: string;
  // Подробное описание из OpenAPI
  description?: string;
  // Идентификатор операции из OpenAPI
  operationId?: string;
}

export interface IInvokeOutcome {
  // Код ответа маршрута
  status: number;
  // Тело ответа как строка
  payload: string;
  // Заголовки ответа
  headers: Record<string, unknown>;
}

export interface IRequestParts {
  // Значения параметров пути
  params: Record<string, unknown>;
  // Значения строки запроса
  query: Record<string, unknown>;
  // Значения тела запроса
  body: Record<string, unknown>;
}
