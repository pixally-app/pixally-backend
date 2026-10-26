-- AlterTable
ALTER TABLE "pix_receipts" ADD COLUMN     "processing_time_ms" INTEGER,
ADD COLUMN     "used_fallback" BOOLEAN;
