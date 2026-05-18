import { useState } from "react";

import { useRouter } from "next/navigation";
import { adminLogin, adminLogout } from "../services/auth.service";
import { useMutation } from "@tanstack/react-query";
export const useAuth = () => {
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: adminLogin,
    onSuccess: () => {
      router.push("/Dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: adminLogout,
    onSuccess: () => {
      router.push("/login");
    },
  });

  return {
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loading: loginMutation.isPending || logoutMutation.isPending,
  };
};