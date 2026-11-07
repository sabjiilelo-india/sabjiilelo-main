/**
 * Demo data: super admin, Jabalpur + Satna areas with admins and staff, a 30-item catalog,
 * three days of stock, vendor rates, coupons and banners. Safe to re-run (upserts by natural keys).
 */
import { PrismaClient, type Role, type UnitType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { addDays, todayIST, ymdToDate } from '@sabjiilelo/shared';

const prisma = new PrismaClient();
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:4000').replace(/\/$/, '');

type V = [label: string, baseQty: number, price: number, mrp: number];
type SeedItem = { name: string; cat: string; unit: UnitType; stock: number; variants: V[]; desc?: string; source?: string; hsn?: string };

const CATEGORIES = ['Fresh Vegetables', 'Leafy & Herbs', 'Fresh Fruits', 'Exotic', 'Daily Essentials'];

// Prices in rupees. Stock in base units (grams for KG items, count otherwise).
const ITEMS: SeedItem[] = [
  { name: 'Tomato (Desi)', cat: 'Fresh Vegetables', unit: 'KG', stock: 80000, variants: [['500 g', 500, 18, 22], ['1 kg', 1000, 34, 42]], source: 'Jabalpur mandi', hsn: '0702' },
  { name: 'Potato', cat: 'Fresh Vegetables', unit: 'KG', stock: 120000, variants: [['1 kg', 1000, 28, 35], ['2 kg', 2000, 54, 70]], source: 'Agra farms', hsn: '0701' },
  { name: 'Onion', cat: 'Fresh Vegetables', unit: 'KG', stock: 100000, variants: [['1 kg', 1000, 36, 45], ['2 kg', 2000, 70, 90]], source: 'Nashik', hsn: '0703' },
  { name: 'Carrot', cat: 'Fresh Vegetables', unit: 'KG', stock: 25000, variants: [['500 g', 500, 30, 38]], hsn: '0706' },
  { name: 'Cucumber', cat: 'Fresh Vegetables', unit: 'KG', stock: 30000, variants: [['500 g', 500, 20, 26]], hsn: '0707' },
  { name: 'Green Capsicum', cat: 'Fresh Vegetables', unit: 'KG', stock: 15000, variants: [['250 g', 250, 22, 28], ['500 g', 500, 42, 55]], hsn: '0709' },
  { name: 'Brinjal (Bharta)', cat: 'Fresh Vegetables', unit: 'PIECE', stock: 120, variants: [['1 pc (~400 g)', 1, 24, 30]], hsn: '0709' },
  { name: 'Cauliflower', cat: 'Fresh Vegetables', unit: 'PIECE', stock: 150, variants: [['1 pc (~600 g)', 1, 35, 45]], hsn: '0704' },
  { name: 'Cabbage', cat: 'Fresh Vegetables', unit: 'PIECE', stock: 120, variants: [['1 pc (~700 g)', 1, 28, 35]], hsn: '0704' },
  { name: 'Bottle Gourd (Lauki)', cat: 'Fresh Vegetables', unit: 'PIECE', stock: 100, variants: [['1 pc', 1, 30, 38]], hsn: '0709' },
  { name: 'Green Peas', cat: 'Fresh Vegetables', unit: 'KG', stock: 20000, variants: [['500 g', 500, 45, 55]], hsn: '0708' },
  { name: 'Lady Finger (Bhindi)', cat: 'Fresh Vegetables', unit: 'KG', stock: 20000, variants: [['250 g', 250, 15, 20], ['500 g', 500, 28, 36]], hsn: '0709' },
  { name: 'Green Chilli', cat: 'Leafy & Herbs', unit: 'KG', stock: 8000, variants: [['100 g', 100, 8, 10], ['250 g', 250, 18, 24]], hsn: '0709' },
  { name: 'Ginger', cat: 'Leafy & Herbs', unit: 'KG', stock: 6000, variants: [['100 g', 100, 14, 18], ['250 g', 250, 32, 40]], hsn: '0910' },
  { name: 'Garlic', cat: 'Leafy & Herbs', unit: 'KG', stock: 8000, variants: [['100 g', 100, 18, 24], ['250 g', 250, 42, 55]], hsn: '0703' },
  { name: 'Coriander (Dhania)', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 200, variants: [['1 bunch', 1, 10, 15]], source: 'Local farm, picked this morning', hsn: '0709' },
  { name: 'Spinach (Palak)', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 150, variants: [['1 bunch (~250 g)', 1, 15, 20]], hsn: '0709' },
  { name: 'Methi', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 120, variants: [['1 bunch', 1, 15, 20]], hsn: '0709' },
  { name: 'Mint (Pudina)', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 100, variants: [['1 bunch', 1, 10, 15]], hsn: '0709' },
  { name: 'Lemon', cat: 'Leafy & Herbs', unit: 'PIECE', stock: 600, variants: [['4 pcs', 4, 20, 25], ['8 pcs', 8, 38, 50]], hsn: '0805' },
  { name: 'Banana (Robusta)', cat: 'Fresh Fruits', unit: 'DOZEN', stock: 120, variants: [['1 dozen', 1, 55, 65]], source: 'Burhanpur', hsn: '0803' },
  { name: 'Apple (Shimla)', cat: 'Fresh Fruits', unit: 'KG', stock: 40000, variants: [['500 g', 500, 85, 100], ['1 kg', 1000, 160, 190]], source: 'Himachal', hsn: '0808' },
  { name: 'Papaya', cat: 'Fresh Fruits', unit: 'PIECE', stock: 60, variants: [['1 pc (~1 kg)', 1, 45, 55]], hsn: '0807' },
  { name: 'Pomegranate', cat: 'Fresh Fruits', unit: 'KG', stock: 20000, variants: [['500 g', 500, 90, 110]], hsn: '0810' },
  { name: 'Orange (Nagpur)', cat: 'Fresh Fruits', unit: 'KG', stock: 30000, variants: [['1 kg', 1000, 80, 95]], source: 'Nagpur', hsn: '0805' },
  { name: 'Watermelon', cat: 'Fresh Fruits', unit: 'PIECE', stock: 40, variants: [['1 pc (~3 kg)', 1, 70, 90]], hsn: '0807' },
  { name: 'Broccoli', cat: 'Exotic', unit: 'PIECE', stock: 40, variants: [['1 pc (~300 g)', 1, 65, 80]], hsn: '0704' },
  { name: 'Mushroom (Button)', cat: 'Exotic', unit: 'PACK', stock: 50, variants: [['200 g pack', 1, 45, 55]], hsn: '0709' },
  { name: 'Kiwi', cat: 'Exotic', unit: 'PIECE', stock: 120, variants: [['3 pcs', 3, 75, 90]], hsn: '0810' },
  { name: 'Coconut (Tender)', cat: 'Daily Essentials', unit: 'PIECE', stock: 80, variants: [['1 pc', 1, 45, 55]], hsn: '0801' },
  // more vegetables
  { name: 'Pumpkin (Kaddu)', cat: 'Fresh Vegetables', unit: 'KG', stock: 25000, variants: [['500 g', 500, 18, 24], ['1 kg', 1000, 34, 44]], hsn: '0709' },
  { name: 'Bitter Gourd (Karela)', cat: 'Fresh Vegetables', unit: 'KG', stock: 12000, variants: [['250 g', 250, 15, 20], ['500 g', 500, 28, 36]], hsn: '0709' },
  { name: 'Ridge Gourd (Turai)', cat: 'Fresh Vegetables', unit: 'KG', stock: 12000, variants: [['500 g', 500, 24, 30]], hsn: '0709' },
  { name: 'Radish (Mooli)', cat: 'Fresh Vegetables', unit: 'KG', stock: 15000, variants: [['500 g', 500, 14, 18]], hsn: '0706' },
  { name: 'Beetroot', cat: 'Fresh Vegetables', unit: 'KG', stock: 15000, variants: [['500 g', 500, 22, 28]], hsn: '0706' },
  { name: 'Sweet Potato (Shakarkandi)', cat: 'Fresh Vegetables', unit: 'KG', stock: 15000, variants: [['500 g', 500, 28, 35]], hsn: '0714' },
  { name: 'French Beans', cat: 'Fresh Vegetables', unit: 'KG', stock: 12000, variants: [['250 g', 250, 20, 26], ['500 g', 500, 38, 48]], hsn: '0708' },
  { name: 'Cluster Beans (Gawar)', cat: 'Fresh Vegetables', unit: 'KG', stock: 8000, variants: [['250 g', 250, 18, 24]], hsn: '0708' },
  { name: 'Drumstick', cat: 'Fresh Vegetables', unit: 'KG', stock: 8000, variants: [['250 g', 250, 25, 32]], hsn: '0709' },
  { name: 'Raw Banana', cat: 'Fresh Vegetables', unit: 'PIECE', stock: 150, variants: [['2 pcs', 2, 20, 26]], hsn: '0803' },
  { name: 'Tinda', cat: 'Fresh Vegetables', unit: 'KG', stock: 8000, variants: [['500 g', 500, 26, 34]], hsn: '0709' },
  { name: 'Spring Onion', cat: 'Fresh Vegetables', unit: 'BUNCH', stock: 100, variants: [['1 bunch', 1, 15, 20]], hsn: '0703' },
  { name: 'Red Onion (Small, Sambhar)', cat: 'Fresh Vegetables', unit: 'KG', stock: 10000, variants: [['500 g', 500, 40, 50]], hsn: '0703' },
  { name: 'Baby Corn', cat: 'Fresh Vegetables', unit: 'PACK', stock: 40, variants: [['200 g pack', 1, 35, 45]], hsn: '0709' },
  // leafy & herbs
  { name: 'Curry Leaves', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 120, variants: [['1 bunch', 1, 8, 10]], hsn: '0709' },
  { name: 'Dill (Sua)', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 80, variants: [['1 bunch', 1, 12, 15]], hsn: '0709' },
  { name: 'Mustard Greens (Sarson)', cat: 'Leafy & Herbs', unit: 'BUNCH', stock: 80, variants: [['1 bunch', 1, 18, 24]], hsn: '0709' },
  { name: 'Raw Turmeric (Haldi)', cat: 'Leafy & Herbs', unit: 'KG', stock: 4000, variants: [['100 g', 100, 16, 20]], hsn: '0910' },
  // fruits
  { name: 'Mango (Dussehri)', cat: 'Fresh Fruits', unit: 'KG', stock: 30000, variants: [['1 kg', 1000, 110, 130]], source: 'Malihabad', hsn: '0804' },
  { name: 'Grapes (Green, Seedless)', cat: 'Fresh Fruits', unit: 'KG', stock: 20000, variants: [['500 g', 500, 60, 75]], source: 'Nashik', hsn: '0806' },
  { name: 'Guava (Amrood)', cat: 'Fresh Fruits', unit: 'KG', stock: 20000, variants: [['500 g', 500, 40, 50]], hsn: '0804' },
  { name: 'Sweet Lime (Mosambi)', cat: 'Fresh Fruits', unit: 'KG', stock: 25000, variants: [['1 kg', 1000, 70, 85]], hsn: '0805' },
  { name: 'Pear (Nashpati)', cat: 'Fresh Fruits', unit: 'KG', stock: 15000, variants: [['500 g', 500, 70, 85]], hsn: '0808' },
  { name: 'Pineapple', cat: 'Fresh Fruits', unit: 'PIECE', stock: 40, variants: [['1 pc (~1 kg)', 1, 70, 85]], hsn: '0804' },
  { name: 'Muskmelon (Kharbuja)', cat: 'Fresh Fruits', unit: 'PIECE', stock: 40, variants: [['1 pc (~1.2 kg)', 1, 55, 70]], hsn: '0807' },
  { name: 'Chikoo (Sapota)', cat: 'Fresh Fruits', unit: 'KG', stock: 12000, variants: [['500 g', 500, 40, 50]], hsn: '0810' },
  { name: 'Custard Apple (Sitaphal)', cat: 'Fresh Fruits', unit: 'KG', stock: 8000, variants: [['500 g', 500, 70, 90]], hsn: '0810' },
  { name: 'Banana (Elaichi)', cat: 'Fresh Fruits', unit: 'DOZEN', stock: 60, variants: [['1 dozen', 1, 80, 95]], hsn: '0803' },
  // exotic
  { name: 'Zucchini', cat: 'Exotic', unit: 'PIECE', stock: 40, variants: [['1 pc (~250 g)', 1, 40, 50]], hsn: '0709' },
  { name: 'Red Bell Pepper', cat: 'Exotic', unit: 'PIECE', stock: 50, variants: [['1 pc', 1, 45, 60]], hsn: '0709' },
  { name: 'Yellow Bell Pepper', cat: 'Exotic', unit: 'PIECE', stock: 50, variants: [['1 pc', 1, 45, 60]], hsn: '0709' },
  { name: 'Cherry Tomato', cat: 'Exotic', unit: 'PACK', stock: 40, variants: [['200 g pack', 1, 50, 65]], hsn: '0702' },
  { name: 'Iceberg Lettuce', cat: 'Exotic', unit: 'PIECE', stock: 40, variants: [['1 pc', 1, 50, 65]], hsn: '0705' },
  { name: 'Avocado', cat: 'Exotic', unit: 'PIECE', stock: 30, variants: [['1 pc', 1, 120, 150]], hsn: '0804' },
  { name: 'Dragon Fruit', cat: 'Exotic', unit: 'PIECE', stock: 30, variants: [['1 pc', 1, 90, 110]], hsn: '0810' },
  // daily essentials
  { name: 'Coriander + Chilli Combo', cat: 'Daily Essentials', unit: 'PACK', stock: 80, variants: [['1 combo', 1, 20, 25]], hsn: '0709' },
  { name: 'Salad Pack (Cucumber, Carrot, Beet)', cat: 'Daily Essentials', unit: 'PACK', stock: 60, variants: [['500 g pack', 1, 45, 55]], hsn: '0709' },
];

const paise = (r: number) => Math.round(r * 100);

async function upsertUser(phone: string, name: string, role: Role, areaId: string | null, createdById?: string) {
  return prisma.user.upsert({
    where: { phone },
    update: { name, role, areaId },
    create: { phone, name, role, areaId, createdById },
  });
}

async function seedArea(code: string, name: string, city: string, pincodes: string[], admin: { phone: string; name: string }, superId: string) {
  const area = await prisma.area.upsert({
    where: { code },
    update: { name, city },
    create: {
      code,
      name,
      city,
      slots: {
        create: [
          { label: 'Morning', startTime: '07:00', endTime: '10:00', cutoffMinutesBefore: 600, capacity: 150, sort: 0 },
          { label: 'Evening', startTime: '17:00', endTime: '20:00', cutoffMinutesBefore: 240, capacity: 150, sort: 1 },
        ],
      },
    },
  });
  for (const pincode of pincodes) {
    await prisma.areaPincode.upsert({ where: { pincode }, update: { areaId: area.id }, create: { pincode, areaId: area.id } });
  }
  const adminUser = await upsertUser(admin.phone, admin.name, 'ADMIN', area.id, superId);

  const catIds = new Map<string, string>();
  for (const [sort, cname] of CATEGORIES.entries()) {
    const existing = await prisma.category.findFirst({ where: { areaId: area.id, name: cname } });
    const c = existing ?? (await prisma.category.create({ data: { areaId: area.id, name: cname, sort } }));
    catIds.set(cname, c.id);
  }

  const today = todayIST();
  for (const it of ITEMS) {
    let item = await prisma.item.findFirst({ where: { areaId: area.id, name: it.name } });
    if (!item) {
      item = await prisma.item.create({
        data: {
          areaId: area.id,
          categoryId: catIds.get(it.cat)!,
          name: it.name,
          description: it.desc ?? `Fresh ${it.name.toLowerCase()}, hand-picked and quality checked every morning.`,
          unitType: it.unit,
          hsnCode: it.hsn,
          sourceNote: it.source,
          variants: {
            create: it.variants.map(([label, baseQty, price, mrp], sort) => ({ label, baseQty, pricePaise: paise(price), mrpPaise: paise(mrp), sort })),
          },
        },
      });
    }
    for (const offset of [0, 1, 2]) {
      const date = ymdToDate(addDays(today, offset));
      await prisma.dailyStock.upsert({
        where: { itemId_date: { itemId: item.id, date } },
        update: {},
        create: { areaId: area.id, itemId: item.id, date, availableQty: it.stock },
      });
    }
  }

  const year = today.slice(0, 4);
  for (const c of [
    { code: 'WELCOME50', description: '₹50 off your first order above ₹199', type: 'FLAT' as const, value: 5000, minOrderPaise: 19900, perUserLimit: 1 },
    { code: 'FRESH10', description: '10% off up to ₹40 on orders above ₹299', type: 'PERCENT' as const, value: 10, maxDiscountPaise: 4000, minOrderPaise: 29900, perUserLimit: 5 },
  ]) {
    await prisma.coupon.upsert({
      where: { areaId_code: { areaId: area.id, code: c.code } },
      update: {},
      create: { ...c, areaId: area.id, validFrom: ymdToDate(`${year}-01-01`), validTo: ymdToDate(`${Number(year) + 1}-12-31`) },
    });
  }

  if (!(await prisma.banner.count({ where: { areaId: area.id } }))) {
    await prisma.banner.createMany({
      data: [
        { areaId: area.id, title: 'Farm fresh, every morning', subtitle: 'Picked at dawn, at your door by 10 AM', imageUrl: `${PUBLIC_URL}/static/images/hero-banner.webp`, sort: 0 },
        { areaId: area.id, title: 'Not fresh? Return it at the door', subtitle: 'Our freshness promise, no questions asked', imageUrl: `${PUBLIC_URL}/static/images/farmer-banner-v2.webp`, sort: 1 },
      ],
    });
  }
  return { area, adminUser };
}

async function main() {
  const username = process.env.SUPERADMIN_USERNAME ?? 'superadmin';
  const password = process.env.SUPERADMIN_PASSWORD ?? 'Sabjii@123';
  const superPhone = process.env.SUPERADMIN_PHONE ?? '9000000000';
  const superUser = await upsertUser(superPhone, 'Super Admin', 'SUPERADMIN', null);
  await prisma.superAdminCredential.upsert({
    where: { userId: superUser.id },
    update: { username, passwordHash: await bcrypt.hash(password, 10) },
    create: { userId: superUser.id, username, passwordHash: await bcrypt.hash(password, 10) },
  });

  const jbp = await seedArea(
    'JBP',
    'Jabalpur',
    'Jabalpur',
    ['482001', '482002', '482003', '482004', '482005', '482008', '482011'],
    { phone: '7897897897', name: 'Jabalpur Admin' },
    superUser.id,
  );
  const sat = await seedArea('SAT', 'Satna', 'Satna', ['485001', '485002', '485005'], { phone: '7797897897', name: 'Satna Admin' }, superUser.id);

  const staff: [string, string, Role, string][] = [
    ['9111111111', 'Rakesh (Manager)', 'MANAGER', jbp.area.id],
    ['9222222222', 'Pooja (Accountant)', 'ACCOUNTANT', jbp.area.id],
    ['9333333333', 'Neha (HR)', 'HR', jbp.area.id],
    ['9444444444', 'Ravi (Delivery)', 'DELIVERY', jbp.area.id],
    ['9444444445', 'Sunil (Delivery)', 'DELIVERY', jbp.area.id],
    ['9555555555', 'Ramesh Patel', 'VENDOR', jbp.area.id],
    ['9555555556', 'Kisan Sabzi Co.', 'VENDOR', jbp.area.id],
    ['9111111112', 'Amit (Manager)', 'MANAGER', sat.area.id],
    ['9444444446', 'Deepak (Delivery)', 'DELIVERY', sat.area.id],
  ];
  for (const [phone, name, role, areaId] of staff) {
    const u = await upsertUser(phone, name, role, areaId, jbp.adminUser.id);
    if (role === 'VENDOR') {
      await prisma.vendor.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, areaId, businessName: name === 'Ramesh Patel' ? 'Patel Fresh Traders' : name, upiId: `${phone}@upi` },
      });
    }
  }

  // Vendor rates for today so the demand screen has a best price to suggest.
  const vendors = await prisma.vendor.findMany({ where: { areaId: jbp.area.id } });
  const items = await prisma.item.findMany({ where: { areaId: jbp.area.id }, include: { variants: true } });
  const today = ymdToDate(todayIST());
  for (const [vi, v] of vendors.entries()) {
    for (const it of items) {
      const v0 = it.variants[0]!;
      const perRateUnit = ['KG', 'GRAM', 'LITRE'].includes(it.unitType) ? (v0.pricePaise * 1000) / v0.baseQty : v0.pricePaise / v0.baseQty;
      const rate = Math.round(perRateUnit * (vi === 0 ? 0.62 : 0.66));
      await prisma.vendorRate.upsert({
        where: { vendorId_itemId_date: { vendorId: v.id, itemId: it.id, date: today } },
        update: {},
        create: { vendorId: v.id, itemId: it.id, date: today, ratePaise: rate },
      });
    }
  }

  // A demo customer with an address in Jabalpur.
  const customer = await upsertUser('9876543210', 'Anjali Sharma', 'CUSTOMER', null);
  if (!(await prisma.address.count({ where: { userId: customer.id } }))) {
    await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Home',
        name: 'Anjali Sharma',
        phone: '9876543210',
        line1: '12, Napier Town, Near Bhawartal Garden',
        landmark: 'Opp. City Hospital',
        city: 'Jabalpur',
        pincode: '482001',
        areaId: jbp.area.id,
        isDefault: true,
      },
    });
  }

  console.log('Seed complete.');
  console.log(`  Super admin  : /admin  ${username} / ${password}`);
  console.log('  JBP admin    : 7897897897   SAT admin: 7797897897');
  console.log('  Manager 9111111111 · Accountant 9222222222 · HR 9333333333');
  console.log('  Delivery 9444444444 · Vendor 9555555555 · Customer 9876543210');
  console.log(`  OTP for everyone: ${process.env.OTP_FIXED ?? '9999'}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
