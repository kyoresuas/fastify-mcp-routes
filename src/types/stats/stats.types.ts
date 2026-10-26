export interface IModeStats {
  // Сколько инструментов видит модель в tools/list
  tools: number;
  // Размер ответа tools/list в символах
  chars: number;
  // Оценка размера в токенах по правилу chars/4
  tokens: number;
}

export interface IMcpStats {
  // Метод оценки размера
  method: string;
  // Маршрутов найдено, опубликовано и закрыто политикой
  routes: {
    total: number;
    exposed: number;
    hidden: number;
  };
  // Размер tools/list в каждом режиме
  modes: {
    tools: IModeStats;
    progressive: IModeStats;
  };
}
