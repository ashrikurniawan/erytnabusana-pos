import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding ErytnaBusana POS database...");

  // 1. Store Settings
  await prisma.storeSetting.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      storeName: "ErytnaBusana",
      tagline: "Toko Alat Jahit & Perlengkapan Busana",
      phone: "0812-3456-7890",
      address: "Jl. KH. Agus Salim No. 45, Pasar Baru, Jakarta",
      receiptHeader: "ErytnaBusana - Pusat Alat Jahit Terlengkap",
      receiptFooter: "Terima kasih atas kunjungan Anda. Barang yang sudah dibeli dapat ditukar maksimal 2 hari dengan membawa struk belanja.",
      allowNegativeStock: false,
    },
  });

  // 2. Users
  const salt = await bcrypt.genSalt(10);
  const adminHash = await bcrypt.hash("admin123", salt);
  const kasirHash = await bcrypt.hash("kasir123", salt);
  const stokHash = await bcrypt.hash("stok123", salt);

  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      name: "Pemilik Toko (Admin)",
      email: "admin@erytnabusana.com",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  const kasir = await prisma.user.upsert({
    where: { username: "kasir1" },
    update: {},
    create: {
      username: "kasir1",
      name: "Siti Rahma (Kasir)",
      email: "kasir1@erytnabusana.com",
      passwordHash: kasirHash,
      role: "KASIR",
    },
  });

  const petugasStok = await prisma.user.upsert({
    where: { username: "stok1" },
    update: {},
    create: {
      username: "stok1",
      name: "Budi Santoso (Stok)",
      email: "stok1@erytnabusana.com",
      passwordHash: stokHash,
      role: "PETUGAS_STOK",
    },
  });

  // 3. Units
  const unitsData = [
    { name: "Pcs", symbol: "pcs" },
    { name: "Lusin", symbol: "lsn" },
    { name: "Meter", symbol: "m" },
    { name: "Yard", symbol: "yd" },
    { name: "Gulung", symbol: "glg" },
  ];

  const unitMap = {};
  for (const u of unitsData) {
    const created = await prisma.unit.upsert({
      where: { name: u.name },
      update: {},
      create: u,
    });
    unitMap[u.name] = created.id;
  }

  // 4. Categories
  const categoriesData = [
    { name: "Benang Jahit", description: "Benang jahit serbaguna, obras, dan bordir" },
    { name: "Kancing Baju", description: "Kancing kemeja, jas, snap, dan hias" },
    { name: "Kain", description: "Kain katun, furing, satin, dan linen" },
    { name: "Resleting", description: "Resleting celana, jaket, dan invisible" },
    { name: "Jarum Jahit", description: "Jarum mesin jahit, tangan, dan pentul" },
    { name: "Renda dan Pita", description: "Renda katun, pita satin, dan organdi" },
    { name: "Karet Elastik", description: "Karet elastik boxer, celana, dan elastik rajut" },
    { name: "Perlengkapan Jahit Lainnya", description: "Gunting kain, meteran, kapur jahit, pendedel" },
  ];

  const catMap = {};
  for (const c of categoriesData) {
    const created = await prisma.category.upsert({
      where: { name: c.name },
      update: {},
      create: c,
    });
    catMap[c.name] = created.id;
  }

  // 5. Products & Tier Pricing
  // Product 1: Test Product according to Acceptance Test 1 & 2
  // Retail: Rp5.000, 12-99: Rp4.000, >=100: Rp3.500
  const benangAstra = await prisma.product.upsert({
    where: { sku: "BNG-AST-01" },
    update: {},
    create: {
      name: "Benang Jahit Astra 500y",
      sku: "BNG-AST-01",
      barcode: "899123456001",
      categoryId: catMap["Benang Jahit"],
      unitId: unitMap["Pcs"],
      brand: "Astra",
      description: "Benang jahit spun polyester 500 yards warna standar",
      costPrice: 2500,
      retailPrice: 5000,
      minStock: 10,
      allowDecimal: false,
      inventory: {
        create: {
          quantity: 50,
          minStock: 10,
        },
      },
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 11, price: 5000, tierName: "Eceran" },
          { minQty: 12, maxQty: 99, price: 4000, tierName: "Grosir Sedang" },
          { minQty: 100, maxQty: null, price: 3500, tierName: "Grosir Besar" },
        ],
      },
    },
  });

  // Record initial movement for Benang Astra
  await prisma.inventoryMovement.create({
    data: {
      productId: benangAstra.id,
      movementType: "INITIAL",
      quantity: 50,
      previousStock: 0,
      resultingStock: 50,
      reason: "Stok awal sistem",
      userId: admin.id,
    },
  });

  // Product 2: Resleting YKK with exactly 5 pcs (for Acceptance Test 4: insufficient stock when buying 6)
  const resletingYkk = await prisma.product.upsert({
    where: { sku: "RSL-YKK-07" },
    update: {},
    create: {
      name: "Resleting YKK 7 inch Celana Hitam",
      sku: "RSL-YKK-07",
      barcode: "899123456002",
      categoryId: catMap["Resleting"],
      unitId: unitMap["Pcs"],
      brand: "YKK",
      costPrice: 2500,
      retailPrice: 4500,
      minStock: 5,
      allowDecimal: false,
      inventory: {
        create: {
          quantity: 5, // Exactly 5 pcs
          minStock: 5,
        },
      },
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 11, price: 4500, tierName: "Eceran" },
          { minQty: 12, maxQty: null, price: 3800, tierName: "Grosir Lusinan" },
        ],
      },
    },
  });

  await prisma.inventoryMovement.create({
    data: {
      productId: resletingYkk.id,
      movementType: "INITIAL",
      quantity: 5,
      previousStock: 0,
      resultingStock: 5,
      reason: "Stok awal pengujian batas stok",
      userId: admin.id,
    },
  });

  // Product 3: Kain Katun Toyobo (Meteran / Decimal)
  const kainToyobo = await prisma.product.upsert({
    where: { sku: "KAN-TYB-01" },
    update: {},
    create: {
      name: "Kain Katun Toyobo Fodu Jepang - Navy",
      sku: "KAN-TYB-01",
      barcode: "899123456003",
      categoryId: catMap["Kain"],
      unitId: unitMap["Meter"],
      brand: "Toyobo",
      costPrice: 24000,
      retailPrice: 35000,
      minStock: 10,
      allowDecimal: true,
      inventory: {
        create: {
          quantity: 40.5,
          minStock: 10,
        },
      },
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 9.9, price: 35000, tierName: "Eceran Meteran" },
          { minQty: 10, maxQty: null, price: 30000, tierName: "Grosir Gulungan/Roll" },
        ],
      },
    },
  });

  // Product 4: Kancing Baju 4 Lubang
  await prisma.product.upsert({
    where: { sku: "KNC-KMG-18L" },
    update: {},
    create: {
      name: "Kancing Kemeja 4 Lubang Putih 18L",
      sku: "KNC-KMG-18L",
      barcode: "899123456004",
      categoryId: catMap["Kancing Baju"],
      unitId: unitMap["Lusin"],
      brand: "Royal",
      costPrice: 3000,
      retailPrice: 6000,
      minStock: 15,
      allowDecimal: false,
      inventory: {
        create: {
          quantity: 80,
          minStock: 15,
        },
      },
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 9, price: 6000, tierName: "Eceran" },
          { minQty: 10, maxQty: null, price: 4800, tierName: "Grosir 10 Lusin+" },
        ],
      },
    },
  });

  // Product 5: Jarum Jahit Mesin DBx1
  await prisma.product.upsert({
    where: { sku: "JRM-ORG-14" },
    update: {},
    create: {
      name: "Jarum Jahit Organ Needles DBx1 No 14",
      sku: "JRM-ORG-14",
      barcode: "899123456005",
      categoryId: catMap["Jarum Jahit"],
      unitId: unitMap["Pcs"],
      brand: "Organ",
      costPrice: 15000,
      retailPrice: 22000,
      minStock: 5,
      allowDecimal: false,
      inventory: {
        create: {
          quantity: 25,
          minStock: 5,
        },
      },
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 9, price: 22000, tierName: "Eceran" },
          { minQty: 10, maxQty: null, price: 18500, tierName: "Grosir 10 Pcs+" },
        ],
      },
    },
  });

  // 6. Customers
  await prisma.customer.upsert({
    where: { id: "cust-umum" },
    update: {},
    create: {
      id: "cust-umum",
      name: "Pelanggan Umum",
      phone: "-",
      type: "UMUM",
      notes: "Pelanggan walk-in umum",
    },
  });

  await prisma.customer.upsert({
    where: { id: "cust-rahma" },
    update: {},
    create: {
      id: "cust-rahma",
      name: "Ibu Rahma Tailor",
      phone: "0813-1122-3344",
      type: "ECERAN",
      notes: "Pelanggan penjahit rumahan langganan",
    },
  });

  await prisma.customer.upsert({
    where: { id: "cust-berkah" },
    update: {},
    create: {
      id: "cust-berkah",
      name: "Konveksi Berkah Busana",
      phone: "0818-9988-7766",
      type: "GROSIR",
      notes: "Konveksi seragam, sering ambil grosir",
    },
  });

  // 7. Suppliers
  await prisma.supplier.upsert({
    where: { id: "supp-astra" },
    update: {},
    create: {
      id: "supp-astra",
      name: "PT Astra Benang Nusantara",
      contactPerson: "Pak Hendra",
      phone: "021-5551234",
      address: "Kawasan Industri Pulo Gadung, Jakarta Timur",
      notes: "Supplier utama aneka benang jahit dan obras",
    },
  });

  await prisma.supplier.upsert({
    where: { id: "supp-mitra" },
    update: {},
    create: {
      id: "supp-mitra",
      name: "CV Mitra Kancing Jaya",
      contactPerson: "Ibu Linda",
      phone: "021-6667890",
      address: "Pasar Pagi Mangga Dua, Jakarta Barat",
      notes: "Supplier kancing, resleting, dan aksesoris jahit",
    },
  });

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
