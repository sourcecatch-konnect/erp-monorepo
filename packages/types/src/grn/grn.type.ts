import { z } from "zod";

import {
  grnGoodsSchema,
  createGRNSchema,
  updateGRNSchema,
  submitGRNSchema,
  cancelGRNSchema,
  grnStatusSchema,
  grnDamagesBySchema,
} from "@skerp/validators";

export type GRNStatus = z.infer<typeof grnStatusSchema>;

export type GRNDamagesBy = z.infer<typeof grnDamagesBySchema>;

export type GRNGoodsInput = z.input<typeof grnGoodsSchema>;

export type CreateGRNBody = z.output<typeof createGRNSchema>;

export type CreateGRNFormInput = z.input<typeof createGRNSchema>;

export type UpdateGRNBody = z.output<typeof updateGRNSchema>;

export type UpdateGRNFormInput = z.input<typeof updateGRNSchema>;

export type SubmitGRNBody = z.output<typeof submitGRNSchema>;

export type CancelGRNBody = z.output<typeof cancelGRNSchema>;

type Ref = {
  id: string;
  name: string;
};

export type GRNBranchLite = {
  id: string;
  name?: string | null;
  branchCode?: string | null;
};



export type GRNLorryReceiptLite = {
  id: string;
  lrNumber: string;
  status: string;
  invoiceNumber?: string | null;
  invoiceAmount?: string | null;
};



export type GRNGoodsRow = {
  id: string;
  grnId: string;

  lrGoodsId: string | null;

  goodsName: string;
  description: string | null;

  totalQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;

  unit: string | null;
  weight: string | null;

  remarks: string | null;

  createdAt: string;
  updatedAt: string;
};

export type GRN = {
  id: string;

  grnNumber: string;

  lorryReceiptId: string;


  status: GRNStatus;

  gateNo: string | null;

  inDateTime: string | null;
  outDateTime: string | null;
  unloadingMinutes: number | null;

  totalQty: number;
  receivedQty: number;
  damageQty: number;
  shortageQty: number;

  totalWeightMt: string | null;

  totalFreight: string | null;
  balanceFreight: string | null;
  freightPerMt: string | null;

  detentionDays: number;
  detentionRate: string | null;
  detentionAmount: string;

  grossTotal: string;

  advanceAmount: string;
  damageAmount: string;
  tdsAmount: string;
  hamaliAmount: string;
  printingStationaryAmount: string;

  netAmount: string;

  labourId: string | null;
  labourCharge: string | null;

  unloadingSupervisorId: string | null;

  damagesBy: GRNDamagesBy | null;

  lrCopyChecked: boolean;
  invoiceChecked: boolean;
  kataReceiptChecked: boolean;
  wayBillChecked: boolean;
  sealNoChecked: boolean;

  lrCopyRemark: string | null;
  invoiceRemark: string | null;
  kataReceiptRemark: string | null;
  wayBillRemark: string | null;
  sealNoRemark: string | null;

  remarks: string | null;
  cancelReason: string | null;

  createdById: string;
  updatedById: string | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;

  lorryReceipt?: GRNLorryReceiptLite | null;


  labour?: Ref | null;
  unloadingSupervisor?: Ref | null;

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

  goods?: GRNGoodsRow[];
};

export type GRNQuickView = Pick<
  GRN,
  | "id"
  | "grnNumber"
  | "status"
  | "gateNo"
  | "totalQty"
  | "receivedQty"
  | "damageQty"
  | "shortageQty"
  | "netAmount"
  | "createdAt"
> & {
  lorryReceipt?: {
    id: string;
    lrNumber: string;
  } | null;


};

export type GRNPreviewGoods = {
  lrGoodsId: string;
  goodsName: string;
  description: string | null;
  totalQty: number;
  unit: string | null;
  weight: string | null;
};

export type GRNPreview = {
  lorryReceipt: {
    id: string;
    lrNumber: string;
    status: string;
    invoiceNumber: string | null;
    invoiceAmount: string | null;
  };

  group: {
    id: string;
    groupNumber: string;
    transportType: string;
    originBranch: GRNBranchLite | null;
    destinationBranch: GRNBranchLite | null;
    consignor: Ref | null;
    consignee: Ref | null;
  } | null;

  goods: GRNPreviewGoods[];

  ewayBill?: {
    id: string;
    ewayBillNo: string;
    expiresAt: string;
    generatedAt: string;
  } | null;
};