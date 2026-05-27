import { ApiError } from "../shared/api-error.type.js";

export type ListMeta = {
  page: number;
  size: number;
  total: number;
};

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta?: ListMeta;
    }
  | {
      ok: false;
      error: ApiError;
    };