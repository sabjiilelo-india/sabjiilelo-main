/**
 * Gives every catalog item a real photo: finds the item's Wikipedia lead image, uploads it to
 * Cloudinary (folder sabjiilelo/items) and stores the Cloudinary URL on every Item with that name.
 *
 *   pnpm db:seed:images            only items that have no photo yet
 *   pnpm db:seed:images -- --force replace photos of all seeded items
 *
 * Photos come from Wikipedia/Wikimedia Commons (free licences, attribution is on each file's Commons page).
 * Swap in your own product photography from the admin catalog page whenever you have it.
 */
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FORCE = process.argv.includes('--force');
const UA = 'SabjiiLeLoSeed/1.0 (grocery app demo images)';

if (process.env.CLOUDINARY_URL) cloudinary.config({ secure: true });
else cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });

/** Item name -> Wikipedia article whose lead photo shows it. Unlisted names use the name minus brackets. */
const WIKI: Record<string, string> = {
  'Tomato (Desi)': 'Tomato', Potato: 'Potato', Onion: 'Onion', Carrot: 'Carrot', Cucumber: 'Cucumber',
  'Green Capsicum': 'Bell pepper', 'Brinjal (Bharta)': 'Eggplant', Cauliflower: 'Cauliflower', Cabbage: 'Cabbage',
  'Bottle Gourd (Lauki)': 'Calabash', 'Green Peas': 'Pea', 'Lady Finger (Bhindi)': 'Okra', 'Green Chilli': 'Chili pepper',
  Ginger: 'Ginger', Garlic: 'Garlic', 'Coriander (Dhania)': 'Coriander', 'Spinach (Palak)': 'Spinach', Methi: 'Fenugreek',
  'Mint (Pudina)': 'Mentha', Lemon: 'Lemon', 'Banana (Robusta)': 'Banana', 'Apple (Shimla)': 'Apple', Papaya: 'Papaya',
  Pomegranate: 'Pomegranate', 'Orange (Nagpur)': 'Orange (fruit)', Watermelon: 'Watermelon', Broccoli: 'Broccoli',
  'Mushroom (Button)': 'Agaricus bisporus', Kiwi: 'Kiwifruit', 'Coconut (Tender)': 'Coconut',
  'Pumpkin (Kaddu)': 'Pumpkin', 'Bitter Gourd (Karela)': 'Momordica charantia', 'Ridge Gourd (Turai)': 'Luffa acutangula',
  'Radish (Mooli)': 'Radish', Beetroot: 'Beetroot', 'Sweet Potato (Shakarkandi)': 'Sweet potato', 'French Beans': 'Green bean',
  'Cluster Beans (Gawar)': 'Guar', Drumstick: 'Moringa oleifera', 'Raw Banana': 'Cooking banana', Tinda: 'Praecitrullus fistulosus',
  'Spring Onion': 'Scallion', 'Red Onion (Small, Sambhar)': 'Shallot', 'Baby Corn': 'Baby corn', 'Curry Leaves': 'Curry tree',
  'Dill (Sua)': 'Dill', 'Mustard Greens (Sarson)': 'Mustard greens', 'Raw Turmeric (Haldi)': 'Turmeric',
  'Mango (Dussehri)': 'Mango', 'Grapes (Green, Seedless)': 'Grape', 'Guava (Amrood)': 'Guava', 'Sweet Lime (Mosambi)': 'Citrus limetta',
  'Pear (Nashpati)': 'Pear', Pineapple: 'Pineapple', 'Muskmelon (Kharbuja)': 'Cantaloupe', 'Chikoo (Sapota)': 'Sapodilla',
  'Custard Apple (Sitaphal)': 'Annona squamosa', 'Banana (Elaichi)': 'Banana', Zucchini: 'Zucchini', 'Red Bell Pepper': 'Bell pepper',
  'Yellow Bell Pepper': 'Bell pepper', 'Cherry Tomato': 'Cherry tomato', 'Iceberg Lettuce': 'Iceberg lettuce', Avocado: 'Avocado',
  'Dragon Fruit': 'Pitaya', 'Coriander + Chilli Combo': 'Coriander', 'Salad Pack (Cucumber, Carrot, Beet)': 'Salad',
};
/** Items that must not share the same photo as another (Wikipedia has one lead image per article). */
const ALT: Record<string, string> = { 'Yellow Bell Pepper': 'Yellow bell pepper', 'Red Bell Pepper': 'Red bell pepper', 'Banana (Elaichi)': 'Banana (Cavendish)' };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function wikiImage(title: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&redirects=1&titles=${encodeURIComponent(title)}&prop=pageimages&piprop=thumbnail&pithumbsize=900&format=json`;
  let r = await fetch(url, { headers: { 'User-Agent': UA } });
  for (let wait = 2000; !r.ok && wait <= 8000; wait *= 2) {
    await new Promise((res) => setTimeout(res, wait)); // rate limited: back off and retry
    r = await fetch(url, { headers: { 'User-Agent': UA } });
  }
  if (!r.ok) return null;
  const j = (await r.json()) as { query?: { pages?: Record<string, { thumbnail?: { source: string } }> } };
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.thumbnail?.source ?? null;
}

async function upload(buf: Buffer, publicId: string): Promise<string> {
  const res = await new Promise<{ secure_url: string }>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'sabjiilelo/items', public_id: publicId, overwrite: true, resource_type: 'image', transformation: [{ width: 800, height: 800, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }] }, (err, r) =>
        err || !r ? reject(err) : resolve(r),
      )
      .end(buf);
  });
  return res.secure_url;
}

async function main() {
  const rows = await prisma.item.findMany({ select: { id: true, name: true, images: true } });
  const names = [...new Set(rows.map((r) => r.name))].filter((n) => n in WIKI);
  const todo = names.filter((n) => FORCE || rows.some((r) => r.name === n && r.images.length === 0));
  console.log(`${todo.length} of ${names.length} seeded items need a photo`);

  const failed: string[] = [];
  for (const name of todo) {
    try {
      const src = (await wikiImage(ALT[name] ?? WIKI[name]!)) ?? (await wikiImage(WIKI[name]!));
      if (!src) throw new Error('no image on Wikipedia');
      const img = await fetch(src, { headers: { 'User-Agent': UA } });
      if (!img.ok) throw new Error(`download ${img.status}`);
      const url = await upload(Buffer.from(await img.arrayBuffer()), slug(name));
      const ids = rows.filter((r) => r.name === name && (FORCE || r.images.length === 0)).map((r) => r.id);
      await prisma.item.updateMany({ where: { id: { in: ids } }, data: { images: [url] } });
      console.log(`  ok   ${name}`);
    } catch (e) {
      failed.push(name);
      console.log(`  FAIL ${name}: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // be polite to Wikipedia
  }
  console.log(failed.length ? `Done. ${failed.length} without a photo: ${failed.join(', ')}` : 'Done. Every item has a photo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
