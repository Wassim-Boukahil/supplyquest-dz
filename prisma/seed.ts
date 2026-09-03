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
  for (const [userIndex, roleName] of userRoles.entries()) {
    const role = roleRecords.find((record) => record.name === roleName)!;
    await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `${roleName.toLowerCase()}${index + 1}@demo.supplyquest.dz`,
        passwordHash,
        firstName: roleName === RoleName.ADMIN ? "Nadia" : roleName === RoleName.MANAGER ? "Karim" : "Yacine",
        lastName: index === 0 ? "Alger" : "Oran",
        userRoles: { create: { roleId: role.id } },
      },
    });
  }

  const warehouseCount = index === 0 ? 3 : 2;
  for (let i = 0; i < warehouseCount; i += 1) {
    await prisma.warehouse.create({
      data: {
        organizationId: organization.id,
        name: `${index === 0 ? "Alger Centre" : "Oran Ouest"} ${i + 1}`,
        code: `${index === 0 ? "ALG" : "ORN"}-${String(i + 1).padStart(2, "0")}`,
        location: index === 0 ? "Zone industrielle Rouiba" : "Zone industrielle Es Sénia",
        wilaya: wilayas[index === 0 ? i : i + 1],
        capacity: 5000 + i * 1500,
      },
    });
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

  for (let i = 0; i < 15; i += 1) {
    await prisma.product.create({
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
    });
  }

  for (let i = 0; i < 10; i += 1) {
    await prisma.customer.create({
      data: {
        organizationId: organization.id,
        name: `Client professionnel ${index + 1}-${String(i + 1).padStart(2, "0")}`,
        email: `customer-${index + 1}-${i + 1}@demo.supplyquest.dz`,
        wilaya: wilayas[(index + i) % wilayas.length],
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
  console.log("Seeded 2 organizations, 6 users, 5 warehouses, 10 categories, 30 products, 10 suppliers, and 20 customers.");
  console.log("Demo password for all seeded users: DemoPass123!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});