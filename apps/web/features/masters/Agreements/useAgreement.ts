import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ListQuery } from "../_shared/master-api";
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
  const cleanSearch = search?.trim() ?? "";

  const query = React.useMemo<ListQuery>(
    () => ({
      page,
      size,
      sort: "agreementDate:desc",
      ...(cleanSearch ? { search: cleanSearch } : {}),
    }),
    [page, size, cleanSearch],
  );

  const result = useQuery({
    queryKey: ["agreements", "company", companyId, page, size, cleanSearch],
    queryFn: () => agreementApi.listByCompany(companyId!, query),
    enabled: Boolean(companyId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const agreements = result.data?.data ?? [];
  const total = result.data?.meta?.total ?? agreements.length;
  const pageCount = Math.max(Math.ceil(total / size), 1);

  return {
    ...result,
    query,
    agreements,
    total,
    pageCount,
  };
}
