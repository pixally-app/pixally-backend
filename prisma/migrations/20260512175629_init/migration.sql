-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "is_active" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zapify_integration" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN,
    "instance_api_url" TEXT,
    "instance_key" TEXT,
    "instance_token" TEXT,

    CONSTRAINT "zapify_integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "document_type" TEXT,
    "status" BOOLEAN,
    "amount" DECIMAL,
    "phones" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phone_client" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "dial_code" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,

    CONSTRAINT "phone_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_contacts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "phone_jid" TEXT NOT NULL,
    "is_active" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pix_receipts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID,
    "status" TEXT,
    "origin" TEXT,
    "document_format" TEXT,
    "description" TEXT,
    "deposit_date_time" TIMESTAMP(3),
    "deposit_amount" DECIMAL,
    "deposit_origin_name" TEXT,
    "deposit_origin_document" TEXT,
    "deposit_origin_document_type" TEXT,
    "deposit_origin_bank" TEXT,
    "deposit_origin_agency" TEXT,
    "deposit_origin_account" TEXT,
    "deposit_destination_name" TEXT,
    "deposit_destination_document" TEXT,
    "deposit_destination_document_type" TEXT,
    "deposit_destination_bank" TEXT,
    "deposit_destination_agency" TEXT,
    "deposit_destination_account" TEXT,
    "pix_transaction_id" TEXT,
    "processment_ocr_outcome" TEXT,
    "jid" TEXT,
    "message_id" TEXT,
    "is_deleted_whatsapp" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pix_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pix_receipts_blob" (
    "id" UUID NOT NULL,
    "pix_receipts_id" UUID,
    "mime_type" TEXT,
    "file_path" TEXT,
    "file_url" TEXT,

    CONSTRAINT "pix_receipts_blob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warnings" (
    "id" UUID NOT NULL,
    "pix_receipt_id" UUID NOT NULL,
    "client_id" UUID,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN,
    "resolution_reason" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts_receivable" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "pix_receipt_id" UUID,
    "client_id" UUID NOT NULL,
    "description_service" TEXT,
    "total_amount" DECIMAL NOT NULL,
    "installment_group_id" UUID,
    "installment_count" INTEGER,
    "installment_number" INTEGER,
    "installment_amount" DECIMAL NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT,
    "paid_at" TIMESTAMP(3),
    "pay_stub" TEXT,
    "matched_automatically" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "zapify_integration" ADD CONSTRAINT "zapify_integration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phone_client" ADD CONSTRAINT "phone_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_contacts" ADD CONSTRAINT "monitored_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_contacts" ADD CONSTRAINT "monitored_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pix_receipts_blob" ADD CONSTRAINT "pix_receipts_blob_pix_receipts_id_fkey" FOREIGN KEY ("pix_receipts_id") REFERENCES "pix_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_pix_receipt_id_fkey" FOREIGN KEY ("pix_receipt_id") REFERENCES "pix_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warnings" ADD CONSTRAINT "warnings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_pix_receipt_id_fkey" FOREIGN KEY ("pix_receipt_id") REFERENCES "pix_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
