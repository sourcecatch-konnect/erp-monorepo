import { api } from "@/lib/api";
import type {
  ApiResponse,
  City,
  CreateCityBody,
  UpdateCityBody,
} from "@skerp/types";
export function unwrapResponse<T>(res: any): T {
  return res.data.data;
}
export const cityApi = {
  list: async () => {
    const res = await api.get("/cities");
    console.log(res)
return res.data.data;
  },

  create: async (body: CreateCityBody) => {
    const res = await api.post<ApiResponse<City>>("/cities", body);
    return unwrapResponse(res.data);
  },

  update: async (id: string, body: UpdateCityBody) => {
    const res = await api.patch<ApiResponse<City>>(`/cities/${id}`, body);
    return unwrapResponse(res.data);
  },

  remove: async (id: string) => {
    const res = await api.delete<ApiResponse<null>>(`/cities/${id}`);
    unwrapResponse(res.data);
  },
};