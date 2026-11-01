/** Friendly fallback artwork for produce without photos. Matched on the item name. */
const EMOJI: [RegExp, string][] = [
  [/tomato/i, '🍅'],
  [/potato|aloo/i, '🥔'],
  [/onion|pyaz/i, '🧅'],
  [/garlic|lehsun/i, '🧄'],
  [/ginger|adrak/i, '🫚'],
  [/carrot|gajar/i, '🥕'],
  [/cucumber|kheera/i, '🥒'],
  [/capsicum|bell pepper|shimla/i, '🫑'],
  [/chilli|chili|mirch/i, '🌶️'],
  [/brinjal|eggplant|baingan/i, '🍆'],
  [/corn|bhutta/i, '🌽'],
  [/broccoli/i, '🥦'],
  [/cauliflower|gobi/i, '🥦'],
  [/cabbage|patta/i, '🥬'],
  [/spinach|palak|methi|leafy|lettuce|saag/i, '🥬'],
  [/coriander|dhania|mint|pudina|curry leaves|herb/i, '🌿'],
  [/lemon|nimbu/i, '🍋'],
  [/mushroom/i, '🍄'],
  [/pea|matar|beans/i, '🫛'],
  [/sweet potato|shakarkand/i, '🍠'],
  [/pumpkin|kaddu|gourd|lauki|tori/i, '🎃'],
  [/coconut|nariyal/i, '🥥'],
  [/banana|kela/i, '🍌'],
  [/apple|seb/i, '🍎'],
  [/mango|aam/i, '🥭'],
  [/grape|angoor/i, '🍇'],
  [/orange|santra|mosambi|kinnow/i, '🍊'],
  [/watermelon|tarbooz/i, '🍉'],
  [/melon|kharbuja/i, '🍈'],
  [/pineapple|ananas/i, '🍍'],
  [/papaya|papita/i, '🥭'],
  [/pomegranate|anar/i, '🍎'],
  [/guava|amrood/i, '🍐'],
  [/pear|nashpati/i, '🍐'],
  [/kiwi/i, '🥝'],
  [/strawberr/i, '🍓'],
  [/cherry/i, '🍒'],
  [/avocado/i, '🥑'],
  [/peach/i, '🍑'],
  [/radish|mooli|beetroot|chukandar/i, '🫜'],
];

export function produceEmoji(name: string): string {
  for (const [re, e] of EMOJI) if (re.test(name)) return e;
  return '🥗';
}

/** Soft tile colours for image placeholders, picked deterministically from the name. */
const TILES = ['#d9f2e0', '#fdebd3', '#fbe3e3', '#eef6e6', '#f5ebd7', '#e3f0fb'];
export function produceTile(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILES[h % TILES.length]!;
}
