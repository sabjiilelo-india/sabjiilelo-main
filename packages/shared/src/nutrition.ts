/**
 * Nutrition facts and benefits shown on the item page. Values are typical averages per 100 g
 * (USDA FoodData Central / IFCT 2017), rounded. They are guidance, not a label claim.
 * `dv` is the percentage of the adult daily value that 100 g supplies.
 */
export interface NutrientHighlight {
  name: string;
  amount: string;
  dv?: number;
}

export interface Nutrition {
  /** What the numbers are per, e.g. "100 g". */
  per: string;
  calories: number;
  protein: number;
  carbs: number;
  fibre: number;
  fat: number;
  /** Vitamins and minerals worth calling out, most important first. */
  highlights: NutrientHighlight[];
  /** Short plain-language benefits. */
  benefits: string[];
  /** One short badge for product cards, e.g. "Rich in Vitamin C". */
  tag?: string;
}

type H = [name: string, amount: string, dv?: number];

function n(
  cal: number,
  protein: number,
  carbs: number,
  fibre: number,
  fat: number,
  highlights: H[],
  benefits: string[],
  tag?: string,
  per = '100 g',
): Nutrition {
  return {
    per,
    calories: cal,
    protein,
    carbs,
    fibre,
    fat,
    highlights: highlights.map(([name, amount, dv]) => ({ name, amount, ...(dv != null ? { dv } : {}) })),
    benefits,
    ...(tag ? { tag } : {}),
  };
}

const TOMATO = n(18, 0.9, 3.9, 1.2, 0.2, [['Vitamin C', '14 mg', 16], ['Vitamin A', '42 mcg', 5], ['Potassium', '237 mg', 5]], ['Lycopene, a natural antioxidant', 'Low in calories, high in water', 'Adds vitamin C to everyday cooking'], 'Rich in Lycopene');
const CORIANDER = n(23, 2.1, 3.7, 2.8, 0.5, [['Vitamin K', '310 mcg', 258], ['Vitamin A', '337 mcg', 37], ['Vitamin C', '27 mg', 30]], ['Very high in vitamin K', 'Fresh flavour with almost no calories', 'Good source of vitamin A'], 'Rich in Vitamin K');

/** First match wins, so specific names come before general ones. */
const RULES: [RegExp, Nutrition][] = [
  [/combo|coriander \+/i, CORIANDER],
  [/salad pack/i, n(28, 1.1, 6.3, 2.0, 0.1, [['Vitamin A', '280 mcg', 31], ['Folate', '45 mcg', 11], ['Vitamin K', '12 mcg', 10]], ['Ready-to-eat mix of cucumber, carrot and beetroot', 'Crunchy and hydrating', 'Good source of vitamin A'], 'Ready to eat')],
  [/cherry tomato/i, TOMATO],
  [/tomato/i, TOMATO],
  [/sweet potato|shakarkand/i, n(86, 1.6, 20.1, 3.0, 0.1, [['Vitamin A', '709 mcg', 79], ['Manganese', '0.3 mg', 11], ['Potassium', '337 mg', 7]], ['Beta-carotene turns into vitamin A', 'Slow-release carbs keep you full', 'Good source of fibre'], 'Rich in Vitamin A')],
  [/potato|aloo/i, n(77, 2.0, 17.5, 2.2, 0.1, [['Vitamin C', '20 mg', 22], ['Vitamin B6', '0.3 mg', 18], ['Potassium', '421 mg', 9]], ['Energy-giving carbohydrates', 'Good source of potassium', 'Contains vitamin B6 and vitamin C'], 'Good source of Potassium')],
  [/spring onion/i, n(32, 1.8, 7.3, 2.6, 0.2, [['Vitamin K', '207 mcg', 172], ['Vitamin C', '19 mg', 21], ['Vitamin A', '50 mcg', 6]], ['Very high in vitamin K', 'Light onion taste for salads and garnish', 'Supplies vitamin C'], 'Rich in Vitamin K')],
  [/onion|pyaz/i, n(40, 1.1, 9.3, 1.7, 0.1, [['Vitamin C', '7 mg', 8], ['Vitamin B6', '0.1 mg', 7], ['Potassium', '146 mg', 3]], ['Contains quercetin, a plant antioxidant', 'Adds flavour with few calories', 'Source of fibre'], 'Natural antioxidants')],
  [/carrot|gajar/i, n(41, 0.9, 9.6, 2.8, 0.2, [['Vitamin A', '835 mcg', 93], ['Vitamin K', '13 mcg', 11], ['Potassium', '320 mg', 7]], ['Beta-carotene supports healthy eyesight', 'Crunchy source of fibre', 'Tasty raw or cooked'], 'Rich in Vitamin A')],
  [/cucumber|kheera/i, n(15, 0.7, 3.6, 0.5, 0.1, [['Vitamin K', '16 mcg', 13], ['Vitamin C', '3 mg', 3], ['Water', '95 g']], ['About 95% water, very hydrating', 'Very low in calories', 'Cooling in summer'], 'Hydrating')],
  [/red bell pepper/i, n(31, 1.0, 6.0, 2.1, 0.3, [['Vitamin C', '128 mg', 142], ['Vitamin A', '157 mcg', 17], ['Vitamin B6', '0.3 mg', 17]], ['More vitamin C than an orange', 'Sweet and crunchy', 'Rich in antioxidants'], 'Rich in Vitamin C')],
  [/yellow bell pepper/i, n(27, 1.0, 6.3, 0.9, 0.2, [['Vitamin C', '183 mg', 203], ['Vitamin B6', '0.2 mg', 12], ['Folate', '26 mcg', 7]], ['Packed with vitamin C', 'Mild and sweet', 'Great raw in salads'], 'Rich in Vitamin C')],
  [/capsicum|bell pepper|shimla mirch/i, n(20, 0.9, 4.6, 1.7, 0.2, [['Vitamin C', '80 mg', 89], ['Vitamin B6', '0.2 mg', 13], ['Vitamin A', '18 mcg', 2]], ['A single serving gives most of a day of vitamin C', 'Low in calories', 'Adds colour and crunch'], 'Rich in Vitamin C')],
  [/brinjal|baingan|eggplant/i, n(25, 1.0, 5.9, 3.0, 0.2, [['Fibre', '3 g', 11], ['Manganese', '0.25 mg', 11], ['Potassium', '229 mg', 5]], ['Good source of fibre', 'Low in calories', 'Skin carries antioxidants'], 'Good source of Fibre')],
  [/cauliflower|gobi/i, n(25, 1.9, 5.0, 2.0, 0.3, [['Vitamin C', '48 mg', 54], ['Folate', '57 mcg', 14], ['Vitamin K', '16 mcg', 13]], ['High in vitamin C', 'Low-carb alternative to rice', 'Contains folate'], 'Rich in Vitamin C')],
  [/cabbage|patta gobi/i, n(25, 1.3, 5.8, 2.5, 0.1, [['Vitamin K', '76 mcg', 63], ['Vitamin C', '37 mg', 41], ['Folate', '43 mcg', 11]], ['Good source of vitamin K and C', 'Low in calories', 'Crunchy raw or cooked'], 'Rich in Vitamin K')],
  [/bottle gourd|lauki/i, n(14, 0.6, 3.4, 0.5, 0, [['Vitamin C', '10 mg', 11], ['Calcium', '26 mg', 2], ['Water', '96 g']], ['About 96% water, light on the stomach', 'Very low in calories', 'Easy to digest'], 'Light & hydrating')],
  [/\bpeas?\b|matar/i, n(81, 5.4, 14.5, 5.1, 0.4, [['Vitamin C', '40 mg', 44], ['Folate', '65 mcg', 16], ['Vitamin K', '25 mcg', 21]], ['Plant protein: 5 g per 100 g', 'High in fibre', 'Contains vitamin C and K'], 'Plant protein')],
  [/lady finger|bhindi|okra/i, n(33, 1.9, 7.5, 3.2, 0.2, [['Vitamin K', '31 mcg', 26], ['Vitamin C', '23 mg', 26], ['Folate', '60 mcg', 15], ['Magnesium', '57 mg', 14]], ['Good source of fibre', 'Contains folate and magnesium', 'Low in calories'], 'Good source of Fibre')],
  [/chilli|chili|mirch/i, n(40, 2.0, 9.5, 1.5, 0.2, [['Vitamin C', '242 mg', 269], ['Vitamin B6', '0.3 mg', 16], ['Vitamin A', '59 mcg', 7]], ['Very high in vitamin C', 'Capsaicin gives the heat', 'A little goes a long way'], 'Vitamin C powerhouse')],
  [/ginger|adrak/i, n(80, 1.8, 17.8, 2.0, 0.8, [['Magnesium', '43 mg', 10], ['Potassium', '415 mg', 9], ['Vitamin B6', '0.2 mg', 9]], ['Gingerol, the compound behind its warmth', 'Traditionally used for colds and digestion', 'Adds flavour to tea and curries'], 'Warming & aromatic')],
  [/garlic|lehsun/i, n(149, 6.4, 33.1, 2.1, 0.5, [['Manganese', '1.7 mg', 73], ['Vitamin B6', '1.2 mg', 73], ['Vitamin C', '31 mg', 35]], ['Contains allicin, a sulphur compound', 'High in manganese and vitamin B6', 'Strong flavour from a small amount'], 'Rich in Vitamin B6')],
  [/coriander|dhania/i, CORIANDER],
  [/spinach|palak/i, n(23, 2.9, 3.6, 2.2, 0.4, [['Vitamin K', '483 mcg', 402], ['Vitamin A', '469 mcg', 52], ['Folate', '194 mcg', 49], ['Iron', '2.7 mg', 15]], ['Excellent source of vitamin K', 'Iron and folate for healthy blood', 'Rich in vitamin A'], 'Rich in Iron & Folate')],
  [/methi|fenugreek/i, n(49, 4.4, 6.0, 1.1, 0.9, [['Vitamin C', '52 mg', 58], ['Calcium', '395 mg', 30], ['Iron', '1.9 mg', 11]], ['Good source of calcium and iron', 'Traditional winter green', 'Slightly bitter, great in parathas'], 'Rich in Calcium')],
  [/mint|pudina/i, n(44, 3.3, 8.4, 6.8, 0.7, [['Iron', '11.9 mg', 66], ['Vitamin A', '203 mcg', 23], ['Vitamin C', '13 mg', 15]], ['Cooling flavour for chutneys and drinks', 'Contains iron and vitamin A', 'Aids a fresh, light feeling after meals'], 'Cooling & fresh')],
  [/curry leaves?|kadi patta/i, n(108, 6.1, 18.7, 6.4, 1.0, [['Calcium', '830 mg', 64], ['Fibre', '6.4 g', 23], ['Iron', '0.9 mg', 5]], ['Very high in calcium', 'Rich in beta-carotene', 'Adds South-Indian aroma'], 'Rich in Calcium')],
  [/dill|sua/i, n(43, 3.5, 7.0, 2.1, 1.1, [['Vitamin C', '85 mg', 94], ['Folate', '150 mcg', 38], ['Vitamin A', '386 mcg', 43], ['Manganese', '1.3 mg', 57]], ['Packed with vitamin C and A', 'Good source of folate', 'Delicate flavour for parathas and dal'], 'Rich in Vitamin C')],
  [/mustard greens|sarson/i, n(27, 2.9, 4.7, 3.2, 0.4, [['Vitamin K', '258 mcg', 215], ['Vitamin C', '70 mg', 78], ['Vitamin A', '151 mcg', 17]], ['Very high in vitamin K', 'Rich in vitamin C', 'Classic for sarson ka saag'], 'Rich in Vitamin K')],
  [/turmeric|haldi/i, n(80, 1.5, 15.0, 3.0, 0.8, [['Curcumin', 'Active compound'], ['Iron', '1.9 mg', 11], ['Manganese', '0.8 mg', 35]], ['Fresh haldi has more aroma than powder', 'Contains curcumin', 'Used in pickles, milk and curries'], 'Fresh haldi')],
  [/lemon|nimbu/i, n(29, 1.1, 9.3, 2.8, 0.3, [['Vitamin C', '53 mg', 59], ['Fibre', '2.8 g', 10], ['Folate', '11 mcg', 3]], ['A squeeze adds vitamin C', 'Helps iron from greens absorb better', 'Refreshing in water and salads'], 'Rich in Vitamin C')],
  [/sweet lime|mosambi/i, n(43, 0.8, 9.3, 0.5, 0.3, [['Vitamin C', '50 mg', 55], ['Potassium', '137 mg', 3], ['Folate', '20 mcg', 5]], ['Juicy and refreshing', 'Good source of vitamin C', 'Light on the stomach'], 'Rich in Vitamin C')],
  [/raw banana|kachcha kela/i, n(122, 1.3, 31.9, 2.3, 0.4, [['Vitamin C', '18 mg', 20], ['Potassium', '499 mg', 11], ['Vitamin A', '56 mcg', 6]], ['Starchy and filling', 'Good source of potassium', 'Used in curries and kebabs'], 'Good source of Potassium')],
  [/banana|kela/i, n(89, 1.1, 22.8, 2.6, 0.3, [['Potassium', '358 mg', 8], ['Vitamin B6', '0.4 mg', 22], ['Vitamin C', '9 mg', 10]], ['Quick natural energy', 'Good source of potassium', 'Easy snack for kids'], 'Good source of Potassium')],
  [/custard apple|sitaphal|sharifa/i, n(94, 2.1, 23.6, 4.4, 0.3, [['Vitamin C', '36 mg', 40], ['Vitamin B6', '0.2 mg', 12], ['Potassium', '382 mg', 8]], ['Creamy seasonal treat', 'Good source of vitamin C', 'High in fibre'], 'Rich in Vitamin C')],
  [/pineapple|ananas/i, n(50, 0.5, 13.1, 1.4, 0.1, [['Vitamin C', '48 mg', 53], ['Manganese', '0.9 mg', 40], ['Vitamin B6', '0.1 mg', 6]], ['Contains bromelain, a natural enzyme', 'High in manganese', 'Sweet and tangy'], 'Rich in Manganese')],
  [/apple|seb/i, n(52, 0.3, 13.8, 2.4, 0.2, [['Fibre', '2.4 g', 9], ['Vitamin C', '5 mg', 5], ['Potassium', '107 mg', 2]], ['Fibre helps you feel full', 'Skin has antioxidants', 'An apple a day...'], 'Good source of Fibre')],
  [/papaya|papita/i, n(43, 0.5, 10.8, 1.7, 0.3, [['Vitamin C', '61 mg', 68], ['Folate', '37 mcg', 9], ['Vitamin A', '47 mcg', 5]], ['High in vitamin C', 'Contains the enzyme papain', 'Gentle on digestion'], 'Rich in Vitamin C')],
  [/pomegranate|anar/i, n(83, 1.7, 18.7, 4.0, 1.2, [['Fibre', '4 g', 14], ['Vitamin K', '16 mcg', 14], ['Vitamin C', '10 mg', 11], ['Folate', '38 mcg', 10]], ['Rich in antioxidants (punicalagins)', 'Good source of fibre', 'Contains folate'], 'Antioxidant rich')],
  [/orange|santra|kinnow/i, n(47, 0.9, 11.8, 2.4, 0.1, [['Vitamin C', '53 mg', 59], ['Folate', '30 mcg', 8], ['Potassium', '181 mg', 4]], ['Classic vitamin C fruit', 'Contains fibre in the pulp', 'Refreshing and juicy'], 'Rich in Vitamin C')],
  [/watermelon|tarbooz/i, n(30, 0.6, 7.6, 0.4, 0.2, [['Vitamin C', '8 mg', 9], ['Vitamin A', '28 mcg', 3], ['Water', '91 g']], ['About 91% water, great in summer', 'Contains lycopene', 'Low in calories'], 'Hydrating')],
  [/broccoli/i, n(34, 2.8, 6.6, 2.6, 0.4, [['Vitamin C', '89 mg', 99], ['Vitamin K', '102 mcg', 85], ['Folate', '63 mcg', 16]], ['Vitamin C and K in one vegetable', 'Good source of fibre', 'Best lightly steamed'], 'Rich in Vitamin C')],
  [/mushroom/i, n(22, 3.1, 3.3, 1.0, 0.3, [['Riboflavin (B2)', '0.4 mg', 31], ['Niacin (B3)', '3.6 mg', 22], ['Potassium', '318 mg', 7], ['Selenium', '9 mcg', 17]], ['Low calorie, high in B vitamins', 'Savoury taste with no fat', 'Good protein for a vegetable'], 'Rich in B vitamins')],
  [/kiwi/i, n(61, 1.1, 14.7, 3.0, 0.5, [['Vitamin C', '93 mg', 103], ['Vitamin K', '40 mcg', 34], ['Vitamin E', '1.5 mg', 10]], ['More vitamin C than an orange', 'Good source of fibre', 'Tangy-sweet taste'], 'Rich in Vitamin C')],
  [/coconut|nariyal/i, n(19, 0.7, 3.7, 1.1, 0.2, [['Potassium', '250 mg', 5], ['Magnesium', '25 mg', 6], ['Sodium', '105 mg', 5]], ['Natural electrolytes for hydration', 'Low in calories', 'Cool and refreshing'], 'Natural electrolytes', '100 ml')],
  [/pumpkin|kaddu/i, n(26, 1.0, 6.5, 0.5, 0.1, [['Vitamin A', '426 mcg', 47], ['Potassium', '340 mg', 7], ['Vitamin C', '9 mg', 10]], ['Rich in beta-carotene', 'Low in calories', 'Naturally sweet taste'], 'Rich in Vitamin A')],
  [/bitter gourd|karela/i, n(17, 1.0, 3.7, 2.8, 0.2, [['Vitamin C', '84 mg', 93], ['Folate', '72 mcg', 18], ['Fibre', '2.8 g', 10]], ['High in vitamin C', 'Traditional favourite for healthy eating', 'Low in calories'], 'Rich in Vitamin C')],
  [/ridge gourd|turai|torai|luffa/i, n(20, 1.2, 4.4, 1.1, 0.2, [['Vitamin C', '12 mg', 13], ['Magnesium', '14 mg', 3], ['Iron', '0.4 mg', 2]], ['Light and easy to digest', 'Low in calories', 'Good everyday sabzi'], 'Light & easy')],
  [/radish|mooli/i, n(16, 0.7, 3.4, 1.6, 0.1, [['Vitamin C', '15 mg', 16], ['Folate', '25 mcg', 6], ['Potassium', '233 mg', 5]], ['Crunchy and low in calories', 'Contains vitamin C', 'Great in salads and parathas'], 'Crunchy & light')],
  [/beetroot|beet/i, n(43, 1.6, 9.6, 2.8, 0.2, [['Folate', '109 mcg', 27], ['Manganese', '0.3 mg', 14], ['Potassium', '325 mg', 7]], ['High in folate', 'Natural nitrates', 'Vibrant colour from betalain'], 'Rich in Folate')],
  [/cluster beans|gawar|guar/i, n(44, 3.2, 6.5, 4.9, 0.4, [['Fibre', '4.9 g', 18], ['Calcium', '130 mg', 10], ['Iron', '1.1 mg', 6]], ['High in fibre', 'Contains calcium and iron', 'A traditional dry sabzi'], 'High in Fibre')],
  [/french beans|green beans|beans/i, n(31, 1.8, 7.0, 2.7, 0.2, [['Vitamin K', '14 mcg', 12], ['Vitamin C', '12 mg', 14], ['Folate', '33 mcg', 8]], ['Good source of fibre', 'Contains vitamins K and C', 'Low in calories'], 'Good source of Fibre')],
  [/drumstick|moringa|sahjan/i, n(37, 2.1, 8.5, 3.2, 0.2, [['Vitamin C', '141 mg', 157], ['Potassium', '461 mg', 10], ['Fibre', '3.2 g', 11]], ['Very high in vitamin C', 'Good source of fibre', 'Used in sambar and curries'], 'Rich in Vitamin C')],
  [/tinda/i, n(21, 1.4, 3.4, 1.0, 0.2, [['Vitamin C', '18 mg', 20], ['Iron', '0.9 mg', 5], ['Fibre', '1 g', 4]], ['Light and easy to digest', 'Low in calories', 'Cooks quickly'], 'Light & easy')],
  [/baby corn/i, n(26, 2.0, 4.7, 2.0, 0.2, [['Vitamin C', '11 mg', 12], ['Folate', '30 mcg', 8], ['Fibre', '2 g', 7]], ['Tender, sweet and low in calories', 'Good in stir-fries', 'Source of fibre'], 'Low calorie')],
  [/mango|aam/i, n(60, 0.8, 15.0, 1.6, 0.4, [['Vitamin C', '36 mg', 40], ['Folate', '43 mcg', 11], ['Vitamin A', '54 mcg', 6]], ['The king of fruits', 'Good source of vitamin C', 'Natural sweetness'], 'Rich in Vitamin C')],
  [/grapes?|angoor/i, n(69, 0.7, 18.1, 0.9, 0.2, [['Vitamin K', '15 mcg', 12], ['Copper', '0.1 mg', 14], ['Potassium', '191 mg', 4]], ['Quick natural energy', 'Seedless and easy to eat', 'Contains plant antioxidants'], 'Natural energy')],
  [/guava|amrood/i, n(68, 2.6, 14.3, 5.4, 1.0, [['Vitamin C', '228 mg', 253], ['Fibre', '5.4 g', 19], ['Folate', '49 mcg', 12]], ['One of the best vitamin C fruits', 'High in fibre', 'Low sugar for a sweet fruit'], 'Vitamin C champion')],
  [/pear|nashpati/i, n(57, 0.4, 15.2, 3.1, 0.1, [['Fibre', '3.1 g', 11], ['Vitamin C', '4 mg', 5], ['Copper', '0.1 mg', 9]], ['Good source of fibre', 'Juicy and gentle', 'Skin has the most fibre'], 'Good source of Fibre')],
  [/muskmelon|kharbuja|cantaloupe/i, n(34, 0.8, 8.2, 0.9, 0.2, [['Vitamin C', '37 mg', 41], ['Vitamin A', '169 mcg', 19], ['Potassium', '267 mg', 6]], ['Hydrating summer fruit', 'Rich in vitamins A and C', 'Low in calories'], 'Hydrating')],
  [/chikoo|sapota/i, n(83, 0.4, 19.9, 5.3, 1.1, [['Fibre', '5.3 g', 19], ['Vitamin C', '15 mg', 16], ['Potassium', '193 mg', 4]], ['High in fibre', 'Naturally sweet and energising', 'Soft and easy to eat'], 'High in Fibre')],
  [/zucchini/i, n(17, 1.2, 3.1, 1.0, 0.3, [['Vitamin C', '18 mg', 20], ['Potassium', '261 mg', 6], ['Vitamin B6', '0.2 mg', 9]], ['Low calorie and versatile', 'Good for grilling and pasta', 'Contains vitamin C'], 'Low calorie')],
  [/lettuce/i, n(14, 0.9, 3.0, 1.2, 0.1, [['Vitamin K', '24 mcg', 20], ['Folate', '29 mcg', 7], ['Vitamin A', '25 mcg', 3]], ['Crisp and refreshing', 'Very low in calories', 'Perfect for salads and burgers'], 'Crisp & light')],
  [/avocado/i, n(160, 2.0, 8.5, 6.7, 14.7, [['Folate', '81 mcg', 20], ['Vitamin K', '21 mcg', 18], ['Vitamin E', '2.1 mg', 14], ['Potassium', '485 mg', 10]], ['Mostly healthy unsaturated fats', 'Very high in fibre', 'Creamy texture'], 'Healthy fats')],
  [/dragon fruit|pitaya/i, n(60, 1.2, 13.0, 3.0, 0.4, [['Magnesium', '40 mg', 10], ['Fibre', '3 g', 11], ['Iron', '0.7 mg', 4]], ['Light, mildly sweet exotic fruit', 'Good source of fibre', 'Tiny edible seeds'], 'Good source of Fibre')],
];

/** Rules match whole words only, so "methi" does not match "something". */
const TABLE: [RegExp, Nutrition][] = RULES.map(([re, data]) => [new RegExp(`\\b(?:${re.source})(?![a-z])`, 'i'), data]);

/** Nutrition for an item, matched on its name. Null when we have no data for it. */
export function nutritionFor(name: string): Nutrition | null {
  for (const [re, data] of TABLE) if (re.test(name)) return data;
  return null;
}

/** Share of the daily value, capped at 100% for a progress bar. */
export function dvBar(dv?: number): number {
  return Math.max(0, Math.min(100, dv ?? 0));
}
