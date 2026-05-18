import { api } from "../lib/api";

type LoginPayload = {
  email: string;
  password: string;
};

export const adminLogin = async (data: LoginPayload) => {
  const res = await api.post("/auth/admin/login", data, {
    withCredentials: true,
  });

  return res.data;
};

export const adminLogout = async () => {
  const res = await api.post("/auth/logout", {}, {
    withCredentials: true,
  });

  return res.data;
};