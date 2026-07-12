-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedById" TEXT,
ADD COLUMN     "reversesJournalEntryId" TEXT;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_reversesJournalEntryId_key" ON "JournalEntry"("reversesJournalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntry_reversesJournalEntryId_idx" ON "JournalEntry"("reversesJournalEntryId");

-- CreateIndex
CREATE INDEX "JournalEntry_reversedById_idx" ON "JournalEntry"("reversedById");

-- CreateIndex
CREATE INDEX "Transaction_voidedById_idx" ON "Transaction"("voidedById");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversesJournalEntryId_fkey" FOREIGN KEY ("reversesJournalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
