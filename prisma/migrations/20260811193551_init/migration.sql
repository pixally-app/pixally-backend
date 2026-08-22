CREATE TYPE "Role" AS ENUM ('admin', 'user');

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "zapify_integration" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "instance_key" TEXT NOT NULL,
    "instance_token" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),

    CONSTRAINT "zapify_integration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "document_type" TEXT,
    "status" BOOLEAN,
    "amount" DECIMAL,
    "phones" JSONB,
    "street" TEXT,
    "neighborhood" TEXT,
    "number" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "phone_client" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "dial_code" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,

    CONSTRAINT "phone_client_pkey" PRIMARY KEY ("id")
);

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
    "account_receivable_id" UUID,
    "installment_id" UUID,

    CONSTRAINT "pix_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "pix_receipts_blob" (
    "id" UUID NOT NULL,
    "pix_receipts_id" UUID,
    "mime_type" TEXT,
    "file_path" TEXT,
    "file_url" TEXT,

    CONSTRAINT "pix_receipts_blob_pkey" PRIMARY KEY ("id")
);

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

CREATE TABLE "accounts_receivable" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "client_name" TEXT NOT NULL,
    "service_name" TEXT NOT NULL,
    "service_description" TEXT,
    "total_amount" DECIMAL NOT NULL,
    "due_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "pay_stub" TEXT,
    "matched_automatically" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_receivable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "installments" (
    "id" UUID NOT NULL,
    "account_receivable_id" UUID NOT NULL,
    "installment_number" INTEGER NOT NULL,
    "amount" DECIMAL NOT NULL,
    "due_date" DATE NOT NULL,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE UNIQUE INDEX "users_document_key" ON "users"("document");

CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

CREATE UNIQUE INDEX "zapify_integration_instance_key_key" ON "zapify_integration"("instance_key");

ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "zapify_integration" ADD CONSTRAINT "zapify_integration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "phone_client" ADD CONSTRAINT "phone_client_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_account_receivable_id_fkey" FOREIGN KEY ("account_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pix_receipts" ADD CONSTRAINT "pix_receipts_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pix_receipts_blob" ADD CONSTRAINT "pix_receipts_blob_pix_receipts_id_fkey" FOREIGN KEY ("pix_receipts_id") REFERENCES "pix_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warnings" ADD CONSTRAINT "warnings_pix_receipt_id_fkey" FOREIGN KEY ("pix_receipt_id") REFERENCES "pix_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warnings" ADD CONSTRAINT "warnings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounts_receivable" ADD CONSTRAINT "accounts_receivable_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "installments" ADD CONSTRAINT "installments_account_receivable_id_fkey" FOREIGN KEY ("account_receivable_id") REFERENCES "accounts_receivable"("id") ON DELETE CASCADE ON UPDATE CASCADE;
