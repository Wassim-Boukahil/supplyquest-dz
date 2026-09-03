-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_category_id_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."products" DROP CONSTRAINT "products_preferred_supplier_id_organization_id_fkey";

-- RenameForeignKey
ALTER TABLE "inventory_transfers" RENAME CONSTRAINT "inventory_transfers_destination_warehouse_id_organization_id_fk" TO "inventory_transfers_destination_warehouse_id_organization__fkey";

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_organization_id_fkey" FOREIGN KEY ("category_id", "organization_id") REFERENCES "product_categories"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_preferred_supplier_id_organization_id_fkey" FOREIGN KEY ("preferred_supplier_id", "organization_id") REFERENCES "suppliers"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
