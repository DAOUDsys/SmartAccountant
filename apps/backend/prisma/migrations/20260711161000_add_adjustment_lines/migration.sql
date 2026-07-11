-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "adjustmentReason" TEXT;

-- CreateTable
CREATE TABLE "TransactionAdjustmentLine" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debitAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionAdjustmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionAdjustmentLine_businessId_idx" ON "TransactionAdjustmentLine"("businessId");

-- CreateIndex
CREATE INDEX "TransactionAdjustmentLine_transactionId_idx" ON "TransactionAdjustmentLine"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionAdjustmentLine_accountId_idx" ON "TransactionAdjustmentLine"("accountId");

-- CreateIndex
CREATE INDEX "TransactionAdjustmentLine_businessId_transactionId_idx" ON "TransactionAdjustmentLine"("businessId", "transactionId");

-- AddForeignKey
ALTER TABLE "TransactionAdjustmentLine" ADD CONSTRAINT "TransactionAdjustmentLine_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAdjustmentLine" ADD CONSTRAINT "TransactionAdjustmentLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionAdjustmentLine" ADD CONSTRAINT "TransactionAdjustmentLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
