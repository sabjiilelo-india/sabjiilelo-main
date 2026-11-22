/**
 * Fills in nutrition facts and benefits for every catalog item that has none yet.
 * Safe to re-run. Pass --force to overwrite items that already have nutrition.
 *   pnpm --filter @sabjiilelo/api db:seed:nutrition
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { nutritionFor } from '@sabjiilelo/shared';

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');

async function main() {
  const rows = await prisma.item.findMany({ select: { id: true, name: true, nutrition: true } });
  let set = 0;
  const missing = new Set<string>();
  for (const r of rows) {
    if (r.nutrition && !FORCE) continue;
    const n = nutritionFor(r.name);
    if (!n) {
      missing.add(r.name);
      continue;
    }
    await prisma.item.update({ where: { id: r.id }, data: { nutrition: n as unknown as Prisma.InputJsonValue } });
    set++;
  }
  console.log(`Nutrition added to ${set} of ${rows.length} items.`);
  if (missing.size) console.log(`No data for: ${[...missing].join(', ')}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
