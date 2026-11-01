import { createEndpoints } from './endpoints';
import { createHttp, type HttpConfig } from './http';

export * from './http';
export * from './endpoints';
export * from './queryKeys';

export function createApi(config: HttpConfig) {
  const http = createHttp(config);
  return { http, ...createEndpoints(http) };
}
