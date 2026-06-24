import { z } from "zod";
import {
  lrStatusSchema,
  lrSourceSchema,
  lrTransportTypeSchema,
  lrTripLegTypeSchema,
  lrPrioritySchema,
  updateLRSchema,
  addEwayBillSchema,
} from "@skerp/validators";

export type LRStatus = z.infer<typeof lrStatusSchema>;
export type LRSource = z.infer<typeof lrSourceSchema>;
export type LRTransportType = z.infer<typeof lrTransportTypeSchema>;
export type LRTripLegType = z.infer<typeof lrTripLegTypeSchema>;
export type LRPriority = z.infer<typeof lrPrioritySchema>;

export type UpdateLRBody = z.output<typeof updateLRSchema>;
export type AddEwayBillBody = z.output<typeof addEwayBillSchema>;
export type AddEwayBillFormInput = z.input<typeof addEwayBillSchema>;

export type LocationRef = {
  id: string;
  name: string;
  address: string | null;
  city?: { id: string; name: string } | null;
};

export type LRGroupRef = {
  id: string;
  groupNumber: string;
  status: string;
};

export type LRGoods = {
  id: string;
  lorryReceiptId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EwayBill = {
  id: string;
  lorryReceiptId: string;
  ewayBillNo: string;
  generatedAt: string;
  expiresAt: string;
  generatedBy: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LRListItem = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  fyCode: string;
  createdAt: string;
  groupId: string;
  loadingLocation: LocationRef | null;
  unloadingLocation: LocationRef | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  group?: LRGroupRef | null;
};

export type LorryReceipt = LRListItem & {
  loadingLocationId: string | null;
  unloadingLocationId: string | null;
  cancelReason: string | null;
  createdById: string;
  updatedById: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  goods: LRGoods[];
  ewayBill: EwayBill | null;
};
