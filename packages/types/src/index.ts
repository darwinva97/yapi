/** Tipos compartidos entre todas las apps de yapi. */

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}

export interface Item {
  id: string;
  name: string;
  createdAt: string;
}

export interface ApiError {
  error: string;
  code?: number;
}

export type ApiResult<T> = { data: T } | ApiError;
