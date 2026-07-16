"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import type {
  AgreementWithRelations,
  RateMatrixWithRelations,
} from "@skerp/types";

import MasterListPage from "../../_shared/MasterListPage";

import { rateMatrixApi } from "../rateMatrix.service";
import { rateMatrixKeys } from "../rateMatrix.key";

import { agreementApi } from "../../Agreements/agreements.service";
import { useCompanyAgreements } from "../../Agreements/useAgreement";

import AgreementDetailDialog from "../../Agreements/agreementDialog";
import { agreementColumns } from "../../Agreements/agreementsTable";

type Props = {
  rateMatrixId: string;
};

export default function RateMatrixCompanyAgreementsPage({
  rateMatrixId,
}: Props) {
  const router = useRouter();

  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedAgreement, setSelectedAgreement] =
    React.useState<AgreementWithRelations | null>(null);

const [size] = React.useState(10);

  const rateMatrixDetail = useQuery({
    queryKey: rateMatrixKeys.detail(rateMatrixId),
    queryFn: () => rateMatrixApi.detail(rateMatrixId),
    enabled: Boolean(rateMatrixId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const detail = rateMatrixDetail.data as RateMatrixWithRelations | undefined;

  const companyId =
    detail?.agreement?.companyId ?? detail?.agreement?.company?.id;

  const companyName = detail?.agreement?.company?.name ?? "-";

  const {
    agreements,
    total,
    isLoading: agreementsLoading,
    refetch,
  } = useCompanyAgreements({
    companyId,
    page,
    size,
    search,
  });

  const isLoading = rateMatrixDetail.isLoading || agreementsLoading;

  return (
    <MasterListPage
      title={`Company Agreements - ${companyName}`}
      data={agreements}
      columns={agreementColumns}
      isLoading={isLoading}
      search={search}
      onSearchChange={setSearch}
      page={page}
      size={size}
      total={total}
      onPageChange={setPage}
      selectedIds={selectedIds}
      onSelectedIdsChange={setSelectedIds}
      onAdd={() => {
        router.push("/masters/agreement");
      }}
      onEdit={() => {
        router.push("/masters/agreement");
      }}
      onView={(row) => {
        setSelectedAgreement(row as AgreementWithRelations);
        setDetailOpen(true);
      }}
      onDelete={async (id) => {
        await agreementApi.remove(id);
        await refetch();
      }}
      onBulkDelete={async () => {
        await agreementApi.bulkRemove(selectedIds);
        setSelectedIds([]);
        await refetch();
      }}
      onImport={async () => {
        throw new Error("Import is not implemented for company agreements.");
      }}
      onExport={() => {
        throw new Error("Export is not implemented for company agreements.");
      }}
    >
      <AgreementDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        data={selectedAgreement ?? undefined}
        isLoading={false}
      />
    </MasterListPage>
  );
}
