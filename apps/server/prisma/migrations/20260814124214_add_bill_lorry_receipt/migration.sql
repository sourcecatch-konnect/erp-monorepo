-- CreateTable
CREATE TABLE "BillLorryReceipt" (
    "billId" TEXT NOT NULL,
    "lrId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillLorryReceipt_pkey" PRIMARY KEY ("billId","lrId")
);

-- CreateIndex
CREATE INDEX "BillLorryReceipt_lrId_idx" ON "BillLorryReceipt"("lrId");

-- AddForeignKey
ALTER TABLE "BillLorryReceipt" ADD CONSTRAINT "BillLorryReceipt_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillLorryReceipt" ADD CONSTRAINT "BillLorryReceipt_lrId_fkey" FOREIGN KEY ("lrId") REFERENCES "LorryReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
