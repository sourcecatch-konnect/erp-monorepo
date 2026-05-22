"use client";

import { useQuery } from "@tanstack/react-query";

import { stateApi } from "../state.service";
import { stateKeys } from "../state.keys";


export function useStateList() {
  return useQuery({
    queryKey: stateKeys.list(),
    queryFn: () => stateApi.list(),
  });
}
