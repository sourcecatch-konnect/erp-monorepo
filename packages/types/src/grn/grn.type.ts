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
  name?: string | null;
};

type UnitRef = {
  id: string;
  code: string;
  name: string;
};

type UserLite = {
  id: string;
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
  email?: string | null;
};
export type GRNEwayBillLite = {
  id: string;
  ewayBillNo: string;
  generatedAt?: string | null;
  expiresAt?: string | null;
};

export type GRNGroupLite = {
  id: string;
  groupNumber: string;
  transportType?: string | null;
  sealNumber?: string | null;
  originBranch?: GRNBranchLite | null;
  destinationBranch?: GRNBranchLite | null;
  consignor?: Ref | null;
  consignee?: Ref | null;
};

export type GRNLorryReceiptLite = {
  id: string;
  lrNumber: string;
  status: string;
  invoiceNumber?: string | null;
  invoiceAmount?: string | null;
  ewayBill?: GRNEwayBillLite | null;
  group?: GRNGroupLite | null;
};

export type GRNAttachmentLite = {
  id: string;
  originalName?: string | null;
  filename?: string | null;
  mime?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | string | null;

  url?: string | null;
  publicUrl?: string | null;
  viewUrl?: string | null;

  path?: string | null;
  filePath?: string | null;
  storagePath?: string | null;
};
export type GRNBranchLite = {
  id: string;
  name?: string | null;
  branchCode?: string | null;
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

  quantityUnitId?: string | null;
  weightUnitId?: string | null;
  quantityUnit?: UnitRef | null;
  weightUnit?: UnitRef | null;
  unit: string | null;
  weight: string | null;
  alreadyLoadedQty?: number;
  loadingDamageQty?: number;
  availableQty?: number;

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
  damagePhotos?: GRNAttachmentLite[];
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
  labourName?: string | null;
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
  unloadingSupervisor?: UserLite | null;

  createdBy?: UserLite | null;
  updatedBy?: UserLite | null;

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
  receivedQty?: number;
  damageQty?: number;
  shortageQty?: number;
  quantityUnitId?: string | null;
  weightUnitId?: string | null;
  quantityUnit?: UnitRef | null;
  weightUnit?: UnitRef | null;
  unit: string | null;
  weight: string | null;
  remarks?: string | null;
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
