import { z } from "zod";

import {
  vpLoadingStatusSchema,
  createVPLoadingSchema,
  updateVPLoadingSchema,
  markVPLoadedSchema,
  cancelVPLoadingSchema,
} from "@skerp/validators";

export type VPLoadingStatus = z.infer<typeof vpLoadingStatusSchema>;

export type CreateVPLoadingBody = z.output<typeof createVPLoadingSchema>;

export type CreateVPLoadingFormInput = z.input<typeof createVPLoadingSchema>;

export type UpdateVPLoadingBody = z.output<typeof updateVPLoadingSchema>;

export type UpdateVPLoadingFormInput = z.input<typeof updateVPLoadingSchema>;

export type MarkVPLoadedBody = z.output<typeof markVPLoadedSchema>;

export type CancelVPLoadingBody = z.output<typeof cancelVPLoadingSchema>;

type Ref = {
  id: string;
  name: string;
};

export type VPLoadingBranchLite = {
  id: string;
  name?: string | null;
  branchCode?: string | null;
};

export type VPLoadingAreaLite = {
  id: string;
  name: string;
};

export type VPLoadingScheduleLite = {
  id: string;
  scheduleNumber: string;
  scheduleName: string;
  scheduleDate: string;
  status: string;
  fromBranch?: VPLoadingBranchLite | null;
  toBranch?: VPLoadingBranchLite | null;
  sourceArea?: VPLoadingAreaLite | null;
  destinationArea?: VPLoadingAreaLite | null;
};

export type VPLoadingMRRRLite = {
  id: string;
  mrRrNumber: string | null;
  status: string;
  rakeType: string | null;
};

export type VPLoadingMRRRRowLite = {
  id: string;
  rowNumber: number;
  rowLabel: string;
  wagonTypeLabel: string;
  sequenceNo: string | null;
  vpNo: string | null;
  mrRrNo: string | null;
  sealNo: string | null;
};

export type VPLoadingLRLite = {
  id: string;
  lrNumber: string;
  status: string;
};

export type VPLoadingGRNLite = {
  id: string;
  grnNumber: string;
  status: string;
  totalQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;
};

export type VPLoading = {
  id: string;

  loadingNumber: string;

  vpScheduleId: string;
  mrRrId: string;
  mrRrRowId: string;
  lorryReceiptId: string;
  grnId: string;

  status: VPLoadingStatus;

  gateNo: string | null;

  loadedQty: number;
  loadedCft: number | null;
  loadedWeightMt: string | null;

  labourId: string | null;
  labourCharge: string | null;

  loadingSupervisorId: string | null;

  loadingStartedAt: string | null;
  loadingCompletedAt: string | null;

  remarks: string | null;
  cancelReason: string | null;

  createdById: string;
  updatedById: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;

  vpSchedule?: VPLoadingScheduleLite | null;
  mrRr?: VPLoadingMRRRLite | null;
  mrRrRow?: VPLoadingMRRRRowLite | null;
  lorryReceipt?: VPLoadingLRLite | null;
  grn?: VPLoadingGRNLite | null;

  labour?: Ref | null;
  loadingSupervisor?: Ref | null;

  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };

  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

export type VPLoadingPreviewRow = {
  mrRrRowId: string;
  rowNumber: number;
  rowLabel: string;
  wagonTypeLabel: string;
  vpNo: string | null;
  mrRrNo: string | null;
  sealNo: string | null;
  loadedQty: number;
};

export type VPLoadingPreviewGRN = {
  grnId: string;
  grnNumber: string;
  lorryReceiptId: string;
  lrNumber: string;
  receivedQty: number;
  loadedQty: number;
  balanceQty: number;
  status: string;
};

export type VPLoadingPreview = {
  vpSchedule: VPLoadingScheduleLite;
  mrRr: VPLoadingMRRRLite | null;
  rows: VPLoadingPreviewRow[];
  grns: VPLoadingPreviewGRN[];
};