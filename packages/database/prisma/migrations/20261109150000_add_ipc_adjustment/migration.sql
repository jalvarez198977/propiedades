-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'IPC_ADJUSTMENT';

-- AlterTable
ALTER TABLE "property_tenants" ADD COLUMN "lastIpcAdjustmentDate" TIMESTAMP(3),
ADD COLUMN "ipcAdjustmentMonths" INTEGER DEFAULT 6;

