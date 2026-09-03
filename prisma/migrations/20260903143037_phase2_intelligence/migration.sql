-- CreateEnum
CREATE TYPE "RecommendationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('CRITICAL_STOCK', 'ESTIMATED_STOCKOUT', 'EXCESS_INVENTORY', 'SLOW_MOVING', 'DEMAND_SPIKE', 'DEMAND_DECLINE', 'SUPPLIER_DELAY', 'WAREHOUSE_IMBALANCE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "replenishment_recommendations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "risk_level" TEXT NOT NULL,
    "recommended_quantity" INTEGER NOT NULL,
    "reorder_point" INTEGER NOT NULL,
    "target_stock" INTEGER NOT NULL,
    "current_available" INTEGER NOT NULL,
    "average_daily_demand" DECIMAL(12,4) NOT NULL,
    "lead_time_days" INTEGER,
    "safety_stock" INTEGER NOT NULL,
    "estimated_impact" DECIMAL(14,2) NOT NULL,
    "stockout_horizon_days" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "replenishment_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "product_id" UUID,
    "warehouse_id" UUID,
    "supplier_id" UUID,
    "fingerprint" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recommended_action" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "replenishment_recommendations_organization_id_status_idx" ON "replenishment_recommendations"("organization_id", "status");

-- CreateIndex
CREATE INDEX "replenishment_recommendations_organization_id_priority_idx" ON "replenishment_recommendations"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "replenishment_recommendations_product_id_idx" ON "replenishment_recommendations"("product_id");

-- CreateIndex
CREATE INDEX "replenishment_recommendations_warehouse_id_idx" ON "replenishment_recommendations"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "replenishment_recommendations_organization_id_product_id_wa_key" ON "replenishment_recommendations"("organization_id", "product_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_organization_id_status_idx" ON "inventory_alerts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "inventory_alerts_organization_id_severity_idx" ON "inventory_alerts"("organization_id", "severity");

-- CreateIndex
CREATE INDEX "inventory_alerts_product_id_idx" ON "inventory_alerts"("product_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_warehouse_id_idx" ON "inventory_alerts"("warehouse_id");

-- CreateIndex
CREATE INDEX "inventory_alerts_supplier_id_idx" ON "inventory_alerts"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_alerts_organization_id_fingerprint_key" ON "inventory_alerts"("organization_id", "fingerprint");

-- AddForeignKey
ALTER TABLE "replenishment_recommendations" ADD CONSTRAINT "replenishment_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_recommendations" ADD CONSTRAINT "replenishment_recommendations_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replenishment_recommendations" ADD CONSTRAINT "replenishment_recommendations_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_supplier_id_organization_id_fkey" FOREIGN KEY ("supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
