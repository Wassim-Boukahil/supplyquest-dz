-- CreateEnum
CREATE TYPE "InventoryTransactionType" AS ENUM ('INITIAL_STOCK', 'PURCHASE_RECEIPT', 'SALE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PROCESSING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryTransferStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- Replace the legacy single-column product relationships with tenant-safe composite foreign keys.
ALTER TABLE "public"."products" DROP CONSTRAINT "products_category_id_fkey";
ALTER TABLE "public"."products" DROP CONSTRAINT "products_preferred_supplier_id_fkey";

-- CreateTable
CREATE TABLE "inventory_levels" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "on_hand_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" "InventoryTransactionType" NOT NULL,
    "reference_type" TEXT,
    "reference_id" UUID,
    "reason" TEXT,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expected_delivery_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "ordered_quantity" INTEGER NOT NULL,
    "received_quantity" INTEGER NOT NULL DEFAULT 0,
    "purchase_unit_price" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "order_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sales_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sales_order_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "selling_unit_price" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "sales_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_warehouse_id" UUID NOT NULL,
    "destination_warehouse_id" UUID NOT NULL,
    "status" "InventoryTransferStatus" NOT NULL DEFAULT 'PENDING',
    "actor_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "inventory_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_transfer_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "inventory_transfer_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inventory_levels_organization_id_idx" ON "inventory_levels"("organization_id");
CREATE INDEX "inventory_levels_product_id_idx" ON "inventory_levels"("product_id");
CREATE INDEX "inventory_levels_warehouse_id_idx" ON "inventory_levels"("warehouse_id");
CREATE UNIQUE INDEX "inventory_levels_organization_id_product_id_warehouse_id_key" ON "inventory_levels"("organization_id", "product_id", "warehouse_id");
CREATE INDEX "inventory_transactions_organization_id_idx" ON "inventory_transactions"("organization_id");
CREATE INDEX "inventory_transactions_product_id_idx" ON "inventory_transactions"("product_id");
CREATE INDEX "inventory_transactions_warehouse_id_idx" ON "inventory_transactions"("warehouse_id");
CREATE INDEX "inventory_transactions_type_idx" ON "inventory_transactions"("type");
CREATE INDEX "inventory_transactions_created_at_idx" ON "inventory_transactions"("created_at");
CREATE INDEX "purchase_orders_organization_id_idx" ON "purchase_orders"("organization_id");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_warehouse_id_idx" ON "purchase_orders"("warehouse_id");
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");
CREATE UNIQUE INDEX "purchase_orders_organization_id_order_number_key" ON "purchase_orders"("organization_id", "order_number");
CREATE UNIQUE INDEX "purchase_orders_id_organization_id_key" ON "purchase_orders"("id", "organization_id");
CREATE INDEX "purchase_order_items_organization_id_idx" ON "purchase_order_items"("organization_id");
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");
CREATE INDEX "sales_orders_organization_id_idx" ON "sales_orders"("organization_id");
CREATE INDEX "sales_orders_customer_id_idx" ON "sales_orders"("customer_id");
CREATE INDEX "sales_orders_warehouse_id_idx" ON "sales_orders"("warehouse_id");
CREATE INDEX "sales_orders_status_idx" ON "sales_orders"("status");
CREATE UNIQUE INDEX "sales_orders_organization_id_order_number_key" ON "sales_orders"("organization_id", "order_number");
CREATE UNIQUE INDEX "sales_orders_id_organization_id_key" ON "sales_orders"("id", "organization_id");
CREATE INDEX "sales_order_items_organization_id_idx" ON "sales_order_items"("organization_id");
CREATE INDEX "sales_order_items_sales_order_id_idx" ON "sales_order_items"("sales_order_id");
CREATE INDEX "sales_order_items_product_id_idx" ON "sales_order_items"("product_id");
CREATE INDEX "inventory_transfers_organization_id_idx" ON "inventory_transfers"("organization_id");
CREATE INDEX "inventory_transfers_source_warehouse_id_idx" ON "inventory_transfers"("source_warehouse_id");
CREATE INDEX "inventory_transfers_destination_warehouse_id_idx" ON "inventory_transfers"("destination_warehouse_id");
CREATE INDEX "inventory_transfers_status_idx" ON "inventory_transfers"("status");
CREATE UNIQUE INDEX "inventory_transfers_id_organization_id_key" ON "inventory_transfers"("id", "organization_id");
CREATE INDEX "inventory_transfer_items_organization_id_idx" ON "inventory_transfer_items"("organization_id");
CREATE INDEX "inventory_transfer_items_transfer_id_idx" ON "inventory_transfer_items"("transfer_id");
CREATE INDEX "inventory_transfer_items_product_id_idx" ON "inventory_transfer_items"("product_id");
CREATE UNIQUE INDEX "customers_id_organization_id_key" ON "customers"("id", "organization_id");
CREATE UNIQUE INDEX "product_categories_id_organization_id_key" ON "product_categories"("id", "organization_id");
CREATE UNIQUE INDEX "products_id_organization_id_key" ON "products"("id", "organization_id");
CREATE UNIQUE INDEX "suppliers_id_organization_id_key" ON "suppliers"("id", "organization_id");
CREATE UNIQUE INDEX "warehouses_id_organization_id_key" ON "warehouses"("id", "organization_id");

ALTER TABLE "products" ADD CONSTRAINT "products_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "product_categories"("id", "organization_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_preferred_supplier_id_organization_id_fkey" FOREIGN KEY ("preferred_supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_organization_id_fkey" FOREIGN KEY ("supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_organization_id_fkey" FOREIGN KEY ("purchase_order_id", "organization_id") REFERENCES "purchase_orders"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_organization_id_fkey" FOREIGN KEY ("customer_id", "organization_id") REFERENCES "customers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_sales_order_id_organization_id_fkey" FOREIGN KEY ("sales_order_id", "organization_id") REFERENCES "sales_orders"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sales_order_items" ADD CONSTRAINT "sales_order_items_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_warehouse_id_organization_id_fkey" FOREIGN KEY ("source_warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_destination_warehouse_id_organization_id_fkey" FOREIGN KEY ("destination_warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_transfer_id_organization_id_fkey" FOREIGN KEY ("transfer_id", "organization_id") REFERENCES "inventory_transfers"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "inventory_transfer_items_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;