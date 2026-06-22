-- Rename description_service to service_description
ALTER TABLE "accounts_receivable" RENAME COLUMN "description_service" TO "service_description";

-- Add service_name column
ALTER TABLE "accounts_receivable" ADD COLUMN "service_name" TEXT;

-- Add client_name column
ALTER TABLE "accounts_receivable" ADD COLUMN "client_name" TEXT;
