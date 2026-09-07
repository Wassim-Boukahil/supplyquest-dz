-- CreateTable
CREATE TABLE "supply_quests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "priority" "RecommendationPriority" NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OPEN',
    "entity_type" TEXT NOT NULL,
    "product_id" UUID,
    "warehouse_id" UUID,
    "supplier_id" UUID,
    "recommendation_id" UUID,
    "reason" TEXT NOT NULL,
    "business_impact" DECIMAL(14,2),
    "recommended_action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "supply_quests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supply_quests_organization_id_status_idx" ON "supply_quests"("organization_id", "status");

-- CreateIndex
CREATE INDEX "supply_quests_organization_id_priority_idx" ON "supply_quests"("organization_id", "priority");

-- CreateIndex
CREATE INDEX "supply_quests_product_id_idx" ON "supply_quests"("product_id");

-- CreateIndex
CREATE INDEX "supply_quests_warehouse_id_idx" ON "supply_quests"("warehouse_id");

-- CreateIndex
CREATE INDEX "supply_quests_supplier_id_idx" ON "supply_quests"("supplier_id");

-- CreateIndex
CREATE UNIQUE INDEX "supply_quests_organization_id_fingerprint_key" ON "supply_quests"("organization_id", "fingerprint");

-- AddForeignKey
ALTER TABLE "supply_quests" ADD CONSTRAINT "supply_quests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_quests" ADD CONSTRAINT "supply_quests_product_id_organization_id_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_quests" ADD CONSTRAINT "supply_quests_warehouse_id_organization_id_fkey" FOREIGN KEY ("warehouse_id", "organization_id") REFERENCES "warehouses"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_quests" ADD CONSTRAINT "supply_quests_supplier_id_organization_id_fkey" FOREIGN KEY ("supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_quests" ADD CONSTRAINT "supply_quests_recommendation_id_fkey" FOREIGN KEY ("recommendation_id") REFERENCES "replenishment_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
