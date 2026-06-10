import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { ListQuery } from "../_shared/master-api";
import { agreementApi } from "./agreements.service";



type UseCompanyAgreementsOptions = {
  companyId?: string;
  page: number;
  size: number;
  search?: string;
};

export function useCompanyAgreements({
  companyId,
  page,
  size,
  search,
}: UseCompanyAgreementsOptions) {
  const query = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "agreementDate:desc",
      ...(search?.trim() ? { search: search.trim() } : {}),
    }),
    [page, size, search]
  );

  const result = useQuery({
    queryKey: ["agreements", "company", companyId, query],
    queryFn: () => agreementApi.listByCompany(companyId!, query),
    enabled: Boolean(companyId),
  });

  return {
    ...result,
    query,
    agreements: result.data?.data ?? [],
    total: result.data?.meta?.total ?? 0,
    pageCount: Math.ceil((result.data?.meta?.total ?? 0) / size),
  };
}