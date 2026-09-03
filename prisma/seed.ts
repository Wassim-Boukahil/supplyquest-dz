import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, RoleName } from "@prisma/client";

const prisma = new PrismaClient();

const roles = [
  [RoleName.ADMIN, "Full access to organization settings and business data."],
  [RoleName.MANAGER, "Operational oversight and approvals."],
  [RoleName.PURCHASER, "Supplier and purchasing operations."],
  [RoleName.ANALYST, "Analytics, forecasts, and reporting."],
  [RoleName.OPERATOR, "Day-to-day warehouse operations."],
] as const;

const wilayas = ["Alger", "Oran", "Blida", "Sétif", "Constantine", "Béjaïa", "Tlemcen", "Annaba"];
const categoryNames = ["Conserves", "Huiles", "Céréales", "Légumineuses", "Boissons", "Produits laitiers", "Épicerie", "Hygiène", "Snacks", "Surgelés"];
const productNames = ["Tomate", "Olive", "Semoule", "Lentilles", "Eau", "Lait", "Sucre", "Savon", "Biscuit", "Haricots"];

async function seedOrganization(slug: string, name: string, index: number) {
  const previous = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
  if (previous) {
    // Explicit child cleanup keeps restrictive product/order foreign keys safe
    // when reseeding a tenant.
    await prisma.inventoryTransaction.deleteMany({ where: { organizationId: previous.id } });
    await prisma.inventoryLevel.deleteMany({ where: { organizationId: previous.id } });
    await prisma.purchaseOrderItem.deleteMany({ where: { organizationId: previous.id } });
    await prisma.purchaseOrder.deleteMany({ where: { organizationId: previous.id } });
    await prisma.salesOrderItem.deleteMany({ where: { organizationId: previous.id } });
    await prisma.salesOrder.deleteMany({ where: { organizationId: previous.id } });
    await prisma.inventoryTransferItem.deleteMany({ where: { organizationId: previous.id } });
    await prisma.inventoryTransfer.deleteMany({ where: { organizationId: previous.id } });
  }
  await prisma.organization.deleteMany({ where: { slug } });
  const organization = await prisma.organization.create({ data: { slug, name } });
  const roleRecords = await Promise.all(roles.map(([role, description]) => prisma.role.upsert({
    where: { name: role },
    update: { description },
    create: { name: role, description },
  })));
  const passwordHash = await bcrypt.hash("DemoPass123!", 10);

  const userRoles = index === 0
    ? [RoleName.ADMIN, RoleName.MANAGER, RoleName.PURCHASER, RoleName.ANALYST, RoleName.OPERATOR]
    : [RoleName.OPERATOR];
  let actorId = "";
  for (const [userIndex, roleName] of userRoles.entries()) {
    const role = roleRecords.find((record) => record.name === roleName)!;
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `${roleName.toLowerCase()}${index + 1}@demo.supplyquest.dz`,
        passwordHash,
        firstName: roleName === RoleName.ADMIN ? "Nadia" : roleName === RoleName.MANAGER ? "Karim" : "Yacine",
        lastName: index === 0 ? "Alger" : "Oran",
        userRoles: { create: { roleId: role.id } },
      },
    });
    if (!actorId || roleName === RoleName.ADMIN) actorId = user.id;
  }

  const warehouseCount = index === 0 ? 3 : 2;
  const warehouses = [];
  for (let i = 0; i < warehouseCount; i += 1) {
    warehouses.push(await prisma.warehouse.create({
      data: {
        organizationId: organization.id,
        name: `${index === 0 ? "Alger Centre" : "Oran Ouest"} ${i + 1}`,
        code: `${index === 0 ? "ALG" : "ORN"}-${String(i + 1).padStart(2, "0")}`,
        location: index === 0 ? "Zone industrielle Rouiba" : "Zone industrielle Es Sénia",
        wilaya: wilayas[index === 0 ? i : i + 1],
        capacity: 5000 + i * 1500,
      },
    }));
  }

  const categories = [];
  for (let i = 0; i < categoryNames.length / 2; i += 1) {
    categories.push(await prisma.productCategory.create({
      data: { organizationId: organization.id, name: `${categoryNames[index * 5 + i]} ${index + 1}` },
    }));
  }

  const suppliers = [];
  for (let i = 0; i < 5; i += 1) {
    suppliers.push(await prisma.supplier.create({
      data: {
        organizationId: organization.id,
        name: `Fournisseur ${productNames[i]} ${index + 1}`,
        email: `supplier-${index + 1}-${i + 1}@demo.supplyquest.dz`,
        phone: `0550 000 ${String(index * 10 + i).padStart(3, "0")}`,
        wilaya: wilayas[(index + i) % wilayas.length],
        averageLeadTime: 3 + i,
      },
    }));
  }

  const products = [];
  for (let i = 0; i < 15; i += 1) {
    products.push(await prisma.product.create({
      data: {
        organizationId: organization.id,
        categoryId: categories[i % categories.length].id,
        preferredSupplierId: suppliers[i % suppliers.length].id,
        sku: `SQ-${index + 1}-${String(i + 1).padStart(3, "0")}`,
        name: `${productNames[i % productNames.length]} distribution ${i + 1}`,
        description: "Produit synthétique pour la démonstration.",
        unit: "carton",
        purchasePrice: 150 + i * 11,
        sellingPrice: 190 + i * 14,
        minimumStock: 20 + i,
        safetyStock: 10 + Math.floor(i / 2),
      },
    }));
  }

  const customers = [];
  for (let i = 0; i < 10; i += 1) {
    customers.push(await prisma.customer.create({
      data: {
        organizationId: organization.id,
        name: `Client professionnel ${index + 1}-${String(i + 1).padStart(2, "0")}`,
        email: `customer-${index + 1}-${i + 1}@demo.supplyquest.dz`,
        wilaya: wilayas[(index + i) % wilayas.length],
      },
    }));
  }

  for (const [productIndex, product] of products.entries()) {
    for (const [warehouseIndex, warehouse] of warehouses.entries()) {
      const quantity = 80 + productIndex * 4 + warehouseIndex * 15;
      await prisma.inventoryLevel.create({ data: { organizationId: organization.id, productId: product.id, warehouseId: warehouse.id, onHandQuantity: quantity } });
      await prisma.inventoryTransaction.create({ data: { organizationId: organization.id, productId: product.id, warehouseId: warehouse.id, quantity, type: "INITIAL_STOCK", reason: "Seeded opening balance", actorId } });
    }
  }

  const partialPurchase = await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id, supplierId: suppliers[0].id, warehouseId: warehouses[0].id,
      orderNumber: `PO-${index + 1}-PARTIAL`, status: "PARTIALLY_RECEIVED",
      expectedDeliveryDate: new Date(Date.now() + 5 * 86400000), notes: "Partial delivery awaiting balance.",
      items: { create: [
        { productId: products[0].id, orderedQuantity: 120, receivedQuantity: 70, purchaseUnitPrice: products[0].purchasePrice },
        { productId: products[1].id, orderedQuantity: 80, receivedQuantity: 30, purchaseUnitPrice: products[1].purchasePrice },
      ] },
    },
  });
  for (const [product, quantity] of [[products[0], 70], [products[1], 30]] as const) {
    await prisma.inventoryLevel.update({ where: { organizationId_productId_warehouseId: { organizationId: organization.id, productId: product.id, warehouseId: warehouses[0].id } }, data: { onHandQuantity: { increment: quantity } } });
    await prisma.inventoryTransaction.create({ data: { organizationId: organization.id, productId: product.id, warehouseId: warehouses[0].id, quantity, type: "PURCHASE_RECEIPT", referenceType: "PURCHASE_ORDER", referenceId: partialPurchase.id, reason: "Seeded partial receipt", actorId } });
  }

  const fullPurchase = await prisma.purchaseOrder.create({
    data: {
      organizationId: organization.id, supplierId: suppliers[1].id, warehouseId: warehouses[1 % warehouses.length].id,
      orderNumber: `PO-${index + 1}-RECEIVED`, status: "RECEIVED",
      expectedDeliveryDate: new Date(Date.now() - 2 * 86400000), notes: "Fully received demonstration order.",
      items: { create: [
        { productId: products[2].id, orderedQuantity: 100, receivedQuantity: 100, purchaseUnitPrice: products[2].purchasePrice },
        { productId: products[3].id, orderedQuantity: 60, receivedQuantity: 60, purchaseUnitPrice: products[3].purchasePrice },
      ] },
    },
  });
  for (const [product, quantity] of [[products[2], 100], [products[3], 60]] as const) {
    await prisma.inventoryLevel.update({ where: { organizationId_productId_warehouseId: { organizationId: organization.id, productId: product.id, warehouseId: warehouses[1 % warehouses.length].id } }, data: { onHandQuantity: { increment: quantity } } });
    await prisma.inventoryTransaction.create({ data: { organizationId: organization.id, productId: product.id, warehouseId: warehouses[1 % warehouses.length].id, quantity, type: "PURCHASE_RECEIPT", referenceType: "PURCHASE_ORDER", referenceId: fullPurchase.id, reason: "Seeded full receipt", actorId } });
  }

  await prisma.salesOrder.create({
    data: {
      organizationId: organization.id, customerId: customers[0].id, warehouseId: warehouses[0].id,
      orderNumber: `SO-${index + 1}-OPEN`, status: "CONFIRMED", notes: "Open customer order.",
      items: { create: [{ productId: products[4].id, quantity: 18, sellingUnitPrice: products[4].sellingPrice }] },
    },
  });
  const completedSale = await prisma.salesOrder.create({
    data: {
      organizationId: organization.id, customerId: customers[1].id, warehouseId: warehouses[0].id,
      orderNumber: `SO-${index + 1}-DONE`, status: "COMPLETED", notes: "Completed demonstration sale.",
      items: { create: [{ productId: products[5].id, quantity: 12, sellingUnitPrice: products[5].sellingPrice }] },
    },
  });
  await prisma.inventoryLevel.update({ where: { organizationId_productId_warehouseId: { organizationId: organization.id, productId: products[5].id, warehouseId: warehouses[0].id } }, data: { onHandQuantity: { decrement: 12 } } });
  await prisma.inventoryTransaction.create({ data: { organizationId: organization.id, productId: products[5].id, warehouseId: warehouses[0].id, quantity: 12, type: "SALE", referenceType: "SALES_ORDER", referenceId: completedSale.id, reason: "Seeded completed sale", actorId } });

  if (warehouses.length > 1) {
    await prisma.inventoryTransfer.create({
      data: {
        organizationId: organization.id, sourceWarehouseId: warehouses[0].id, destinationWarehouseId: warehouses[1].id,
        status: "PENDING", actorId, notes: "Rebalance slow-moving stock.",
        items: { create: [{ productId: products[6].id, quantity: 20 }] },
      },
    });
  }
}

async function main() {
  for (const [role, description] of roles) {
    await prisma.role.upsert({ where: { name: role }, update: { description }, create: { name: role, description } });
  }
  await seedOrganization("demo-alger", "Demo Distribution Alger", 0);
  await seedOrganization("demo-oran", "Demo Wholesale Oran", 1);
  console.log("Seeded 2 organizations with products, categories, suppliers, customers, warehouses, inventory history, purchase orders, sales orders, and transfers.");
  console.log("Demo password for all seeded users: DemoPass123!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});