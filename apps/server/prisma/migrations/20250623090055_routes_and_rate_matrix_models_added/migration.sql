-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "sourceCityId" TEXT NOT NULL,
    "destinationCityId" TEXT NOT NULL,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateMatrix" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "transitDays" INTEGER,
    "remarks" TEXT,

    CONSTRAINT "RateMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Route_sourceCityId_destinationCityId_key" ON "Route"("sourceCityId", "destinationCityId");

-- CreateIndex
CREATE UNIQUE INDEX "RateMatrix_agreementId_routeId_key" ON "RateMatrix"("agreementId", "routeId");

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_sourceCityId_fkey" FOREIGN KEY ("sourceCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_destinationCityId_fkey" FOREIGN KEY ("destinationCityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "Agreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RateMatrix" ADD CONSTRAINT "RateMatrix_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
