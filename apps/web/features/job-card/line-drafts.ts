/** Shared draft shapes between JobCardFormPage and AddPartDialog — kept
 *  separate to avoid a circular import between the two components. */

export type PartLineDraft = {
  key: string;
  sparePartId: string;
  sparePartName: string;
  batchId: string;
  batchNo: string;
  sourceInvoiceNumber: string | null;
  unitCostPaise: string;
  mechanicId: string;
  qty: string;
  description: string;
};

export type ServiceLineDraft = {
  key: string;
  serviceProviderId: string;
  serviceProviderName: string;
  sparePartId: string;
  serviceName: string;
  mechanicId: string;
  qty: string;
  rate: string;
  description: string;
};

export const newPartLine = (): PartLineDraft => ({
  key: Math.random().toString(36).slice(2),
  sparePartId: "",
  sparePartName: "",
  batchId: "",
  batchNo: "",
  sourceInvoiceNumber: null,
  unitCostPaise: "0",
  mechanicId: "",
  qty: "",
  description: "",
});

export const newServiceLine = (): ServiceLineDraft => ({
  key: Math.random().toString(36).slice(2),
  serviceProviderId: "",
  serviceProviderName: "",
  sparePartId: "",
  serviceName: "",
  mechanicId: "",
  qty: "",
  rate: "",
  description: "",
});
