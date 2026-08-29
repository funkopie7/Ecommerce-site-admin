import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/* Funkopie sells real, licensed collectibles, so every listing below is
   labelled to match what is actually shown in its photograph. Where a photo
   shows a piece we cannot attribute to a licence with confidence (an
   unbranded Pop!-style vinyl, an original fantasy statue, a musha ningyō
   doll), it is listed honestly as an unattributed / original piece rather
   than given a franchise it does not belong to. */

const CATEGORIES = [
  { key: "anime", name: "Anime", slug: "anime", description: "Shonen heroes, mecha and cult classics — Demon Slayer, Dragon Ball, Akira, Patlabor." },
  { key: "marvel", name: "Marvel", slug: "marvel", description: "Marvel heroes, from the classic red-and-blue web-slinger to the Avengers roster." },
  { key: "dc", name: "DC", slug: "dc", description: "Gotham and Metropolis on one shelf — Batman, Superman and the DC line-up." },
  { key: "star-wars", name: "Star Wars", slug: "star-wars", description: "Imperial troopers and galaxy-far-away sculpts, weathered exactly as issued." },
  { key: "movies-cartoons", name: "Movies & Cartoons", slug: "movies-cartoons", description: "Pixar, LEGO and Saturday-morning favourites — Woody, minifigures, ponies." },
  { key: "custom-figures", name: "Custom Figures", slug: "custom-figures", description: "Designer art toys, blind-box pulls and original sculpts with no franchise tie." },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

/* Slugs retired by the honest-relabelling pass. Removed after the products
   have been re-pointed at the new categories so nothing is orphaned. */
const RETIRED_CATEGORY_SLUGS = ["anime-icons", "retro-arcade", "space-legends", "kaiju-club", "indie-artists", "mini-icons"];

type Seed = {
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  category: CategoryKey;
  franchise: string;
  character: string;
  edition: string;
  releaseDate: string;
  badges: string[];
  characterStory: string;
  funFacts: string[];
  imageUrl: string;
};

const PRODUCTS: Seed[] = [
  /* ---------------- Anime ---------------- */
  {
    sku: "AIC-004",
    slug: "tanjiro-kamado",
    name: "Tanjiro Kamado",
    description: "A chibi-proportioned Tanjiro Kamado figure in his Demon Slayer Corps uniform and green checkered haori, hand-painted and mounted on a black display disc.",
    price: 449900,
    cost: 198000,
    stockQuantity: 26,
    category: "anime",
    franchise: "Demon Slayer",
    character: "Tanjiro Kamado",
    edition: "Standard",
    releaseDate: "2026-06-01",
    badges: ["NEW", "FAN_FAVORITE"],
    characterStory:
      "Tanjiro Kamado joins the Demon Slayer Corps after his family is attacked and his sister Nezuko is turned into a demon. He fights with Water Breathing forms and, later, the Hinokami Kagura passed down through his family — and he is known as much for his kindness toward the demons he faces as for his blade.",
    funFacts: [
      "Wears the hanafuda earrings inherited from his father",
      "Trained in the Water Breathing forms under Sakonji Urokodaki",
      "The green-and-black checkered haori is the character's most recognisable detail",
    ],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1765633358993-c8a68fd47d6f.jpg",
  },
  {
    sku: "AIC-001",
    slug: "goku-super-saiyan",
    name: "Goku Super Saiyan",
    description: "A Super Saiyan Goku figure in torn orange gi and blue boots, sculpted mid-transformation with the signature spiked golden hair.",
    price: 349900,
    cost: 154000,
    stockQuantity: 32,
    category: "anime",
    franchise: "Dragon Ball",
    character: "Goku",
    edition: "Standard",
    releaseDate: "2026-06-01",
    badges: ["NEW"],
    characterStory:
      "Goku is the Saiyan raised on Earth who keeps looking for a stronger opponent than the last one. This sculpt catches him in his Super Saiyan form, gi already torn from the fight that got him there.",
    funFacts: ["Sculpted in the Super Saiyan form from the Frieza arc", "Battle-damage on the gi is moulded, not printed", "Hand-painted golden hair with a two-tone shadow wash"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1606663889134-b1dedb5ed8b7.jpg",
  },
  {
    sku: "RAR-002",
    slug: "kaneda-and-the-red-bike",
    name: "Kaneda and the Red Bike",
    description: "Shotaro Kaneda seated on his red power bike, complete with the Canon, Citizen and Shoei sponsor decals and a separate laser-rifle accessory.",
    price: 1899900,
    cost: 890000,
    stockQuantity: 6,
    category: "anime",
    franchise: "Akira",
    character: "Shotaro Kaneda",
    edition: "Chase",
    releaseDate: "2026-05-02",
    badges: ["LIMITED", "FAN_FAVORITE"],
    characterStory:
      "Kaneda leads a biker gang through Neo-Tokyo and spends most of the story chasing after his friend Tetsuo. The bike is as famous as he is — arguably more so.",
    funFacts: ["Bike carries the film's original sponsor decals", "Includes the removable laser rifle", "Kaneda's jacket is a separate soft-goods piece"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1700909416178-40b292788200.jpg",
  },
  {
    sku: "RAR-001",
    slug: "av-98-ingram",
    name: "AV-98 Ingram Patrol Labor",
    description: "The AV-98 Ingram in Tokyo Metropolitan Police livery, shield and all, with the unit's number plate and 警視庁 markings picked out in tampo print.",
    price: 1299900,
    cost: 590000,
    stockQuantity: 11,
    category: "anime",
    franchise: "Patlabor",
    character: "AV-98 Ingram",
    edition: "Standard",
    releaseDate: "2026-03-10",
    badges: ["NEW"],
    characterStory:
      "The Ingram is the patrol labor issued to Special Vehicles Section 2 — a police mecha that spends as much time filling out paperwork as it does making arrests.",
    funFacts: ["Police shield and number plate are printed, not stickered", "Articulated at the shoulders, elbows, hips and knees", "Displayed here in the standard patrol livery"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1700909415800-6d2a5a83a234.jpg",
  },

  /* ---------------- Marvel ---------------- */
  {
    sku: "AIC-002",
    slug: "spider-man-classic-suit",
    name: "Spider-Man Classic Suit",
    description: "Spider-Man in the classic red-and-blue suit, fully articulated, with the webbing pattern hand-lined across the mask, torso and boots.",
    price: 899900,
    cost: 400000,
    stockQuantity: 14,
    category: "marvel",
    franchise: "Marvel",
    character: "Spider-Man",
    edition: "Deluxe",
    releaseDate: "2026-04-14",
    badges: ["LIMITED", "FAN_FAVORITE"],
    characterStory:
      "Peter Parker's original red-and-blue costume, still the one most collectors want on the shelf. This is the standing display pose rather than a crouched web-shot.",
    funFacts: ["Classic red-and-blue costume, not a movie variant", "Webbing lines are printed over the sculpted suit texture", "Stands unaided without a base"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1529335764857-3f1164d1cb24.jpg",
  },
  {
    sku: "KJC-002",
    slug: "falcon-sam-wilson",
    name: "Falcon",
    description: "Sam Wilson as the Falcon in the classic red-and-white flight suit, wings swept back, mounted on a sculpted rubble base.",
    price: 999900,
    cost: 450000,
    stockQuantity: 12,
    category: "marvel",
    franchise: "Marvel",
    character: "Falcon (Sam Wilson)",
    edition: "Deluxe",
    releaseDate: "2026-05-28",
    badges: ["FAN_FAVORITE"],
    characterStory:
      "Sam Wilson flies with a harness of his own design and has been the Avengers' eyes in the air for most of his run. The classic comics costume, not the film suit.",
    funFacts: ["Classic comic-book costume colourway", "Wings are a separate moulded piece", "Comes attached to its own rubble display base"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1608697341777-80b7461d93c3.jpg",
  },

  /* ---------------- DC ---------------- */
  {
    sku: "RAR-003",
    slug: "batman-caped-crusader",
    name: "Batman: The Caped Crusader",
    description: "A matte-black Batman statue with a sculpted cape, armoured cowl and the yellow-free chest emblem, finished with a grey drybrush over the muscle sculpt.",
    price: 899900,
    cost: 410000,
    stockQuantity: 15,
    category: "dc",
    franchise: "DC",
    character: "Batman",
    edition: "Deluxe",
    releaseDate: "2026-08-01",
    badges: ["PRE_ORDER"],
    characterStory: "Bruce Wayne's Batman, in the modern armoured suit with the monochrome bat emblem. Cowl, cape and utility belt all sculpted as one piece for a clean display silhouette.",
    funFacts: ["Modern armoured-suit sculpt with the black-on-grey emblem", "Cape is a solid sculpted piece, not fabric", "Utility belt is painted in a separate off-white pass"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1700825073852-1913b3886584.jpg",
  },
  {
    sku: "MNI-001",
    slug: "superman-man-of-steel",
    name: "Superman: Man of Steel",
    description: "A fully articulated Superman figure in the darker blue Man of Steel suit, with a real fabric cape and the textured kryptonian weave sculpted into the bodysuit.",
    price: 799900,
    cost: 360000,
    stockQuantity: 20,
    category: "dc",
    franchise: "DC",
    character: "Superman",
    edition: "Standard",
    releaseDate: "2026-04-22",
    badges: ["NEW"],
    characterStory: "Kal-El in the modern film costume — deeper blue, no trunks, and the raised red S-shield. Photographed against white so you can see the suit texture properly.",
    funFacts: ["Soft-goods cape rather than a moulded one", "Suit weave is sculpted into the surface, not printed", "Articulated at the neck, shoulders, elbows, wrists, hips, knees and ankles"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1558679908-541bcf1249ff.jpg",
  },

  /* ---------------- Star Wars ---------------- */
  {
    sku: "KJC-001",
    slug: "sandtrooper-desert-patrol",
    name: "Sandtrooper: Desert Patrol",
    description: "A weathered Imperial sandtrooper in a kneeling firing pose, blaster rifle raised, with the black pauldron and full field kit.",
    price: 699900,
    cost: 310000,
    stockQuantity: 22,
    category: "star-wars",
    franchise: "Star Wars",
    character: "Sandtrooper",
    edition: "Standard",
    releaseDate: "2026-04-05",
    badges: ["NEW"],
    characterStory: "Imperial sandtroopers were the ones combing Tatooine for the missing droids. The dust weathering on the armour is applied at the factory, plate by plate.",
    funFacts: ["Black pauldron denotes the squad's rank marking", "Armour weathering is sprayed and drybrushed, not printed", "Includes the standard-issue blaster rifle"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1623039902375-29258147f39e.jpg",
  },
  {
    sku: "KJC-003",
    slug: "sandtrooper-squad-leader",
    name: "Sandtrooper: Squad Leader",
    description: "The standing squad-leader variant of the Imperial sandtrooper, backpack and survival kit mounted, blaster slung across the chest.",
    price: 1399900,
    cost: 630000,
    stockQuantity: 7,
    category: "star-wars",
    franchise: "Star Wars",
    character: "Sandtrooper",
    edition: "Exclusive",
    releaseDate: "2026-07-08",
    badges: ["LIMITED", "PRE_ORDER"],
    characterStory: "The same trooper, one rank up and one pose over: standing, pack loaded, rifle stowed. Displayed alongside the Desert Patrol figure it reads as a two-man detail.",
    funFacts: ["Squad-leader variant with the full field backpack", "Poses to pair with the Desert Patrol sandtrooper", "Exclusive to this release window"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1623039958673-08c3f4376009.jpg",
  },

  /* ---------------- Movies & Cartoons ---------------- */
  {
    sku: "SPL-003",
    slug: "woody-toy-story",
    name: "Woody",
    description: "The Toy Story pull-string cowboy in his yellow plaid shirt, cow-print vest and hat, with the classic bendy-limb body.",
    price: 1599900,
    cost: 720000,
    stockQuantity: 5,
    category: "movies-cartoons",
    franchise: "Disney Pixar",
    character: "Woody",
    edition: "Chase",
    releaseDate: "2026-08-15",
    badges: ["PRE_ORDER", "LIMITED"],
    characterStory: "Sheriff Woody, Andy's favourite toy and the one who keeps the rest of the toy box in line. Hat is removable, as it should be.",
    funFacts: ["Removable cowboy hat", "Bendable arms and legs for posing", "Yellow plaid shirt and cow-print vest are printed fabric-effect"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1649903303524-a69737c90212.jpg",
  },
  {
    sku: "IND-002",
    slug: "lego-ghost-minifigure",
    name: "LEGO Ghost Minifigure",
    description: "The classic LEGO ghost minifigure — printed shroud, hooded head piece and the grey robe that slips over a standard minifigure body.",
    price: 109900,
    cost: 49000,
    stockQuantity: 9,
    category: "movies-cartoons",
    franchise: "LEGO",
    character: "Ghost Minifigure",
    edition: "Deluxe",
    releaseDate: "2026-06-30",
    badges: ["LIMITED", "FAN_FAVORITE"],
    characterStory: "The LEGO ghost has been haunting castle and Halloween sets since the 1990s, and the shroud has barely changed since. Still one of the most-traded minifigures going.",
    funFacts: ["The shroud is a separate slip-on piece", "Printed face sits under the hood", "Fits any standard minifigure body"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1690041638795-14c34f90da9a.jpg",
  },
  {
    sku: "IND-003",
    slug: "my-little-pony-chibi-set",
    name: "My Little Pony Chibi Set of Five",
    description: "Five chibi-style My Little Pony vinyl figures sold as one set — soft pastel colourways, oversized eyes and moulded manes.",
    price: 159900,
    cost: 74000,
    stockQuantity: 14,
    category: "movies-cartoons",
    franchise: "My Little Pony",
    character: "Fluttershy & Friends",
    edition: "Standard",
    releaseDate: "2026-08-10",
    badges: ["NEW"],
    characterStory: "Five of the show's best-known ponies, shrunk to chibi proportions and sat in a row. Sold as a complete set rather than blind-boxed, so you get all five.",
    funFacts: ["Sold as a complete five-figure set, no duplicates", "Each pony sits about two inches tall", "Manes and tails are moulded, not rooted hair"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1767026916692-aa8f9cd220ef.jpg",
  },

  /* ---------------- Custom Figures ---------------- */
  {
    sku: "MNI-002",
    slug: "hirono-cardboard-cargo",
    name: "Hirono: Cardboard Cargo",
    description: "A large-format Hirono designer vinyl wearing a cardboard-box costume printed with shipping marks, bandaged hand raised, on a steel display disc.",
    price: 1999900,
    cost: 850000,
    stockQuantity: 4,
    category: "custom-figures",
    franchise: "POP MART",
    character: "Hirono",
    edition: "Deluxe",
    releaseDate: "2026-05-15",
    badges: ["LIMITED"],
    characterStory: "Hirono is Lang's designer-toy character for POP MART — a sulky boy whose whole appeal is that he never quite looks at you. This release puts him inside a shipping box, stencils and all.",
    funFacts: ["Designer art toy rather than a licensed character figure", "Cardboard costume is moulded vinyl with printed shipping marks", "Large-format release, well above blind-box scale"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1769345749373-d1407c84cdbf.jpg",
  },
  {
    sku: "SPL-001",
    slug: "pop-vinyl-red-flight-suit",
    name: "Pop! Vinyl: Red Flight Suit",
    description: "A Pop!-style vinyl figure in a red NASA-patched flight suit holding a microphone, with printed floral trainers. Sold unattributed — the licensed character is not marked on the piece we photographed.",
    price: 599900,
    cost: 260000,
    stockQuantity: 25,
    category: "custom-figures",
    franchise: "Funko Pop!",
    character: "Flight Suit Pop!",
    edition: "Standard",
    releaseDate: "2026-03-25",
    badges: ["NEW"],
    characterStory: "We list this one honestly: it is a Pop!-format vinyl in a red mission flight suit with a microphone in hand, and we cannot confirm which licensed character it depicts. If you recognise it, tell us and we will correct the listing.",
    funFacts: ["Sold as an unattributed Pop!-format vinyl", "NASA meatball and two mission patches on the chest", "Printed floral trainers, sculpted separately from the suit"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1718254951230-dac05b0ff8b9.jpg",
  },
  {
    sku: "IND-001",
    slug: "pop-vinyl-denim-jacket",
    name: "Pop! Vinyl: Denim Jacket",
    description: "A Pop!-style vinyl figure with a dark bob, patched denim jacket, rolled jeans and black high-tops. Listed unattributed — no licence marking on the piece.",
    price: 549900,
    cost: 240000,
    stockQuantity: 18,
    category: "custom-figures",
    franchise: "Funko Pop!",
    character: "Denim Jacket Pop!",
    edition: "Standard",
    releaseDate: "2026-03-18",
    badges: ["NEW"],
    characterStory: "Another honest listing: a Pop!-format vinyl we stock as an unattributed piece. Everyday clothes, no franchise markings, and no claim from us about who it is meant to be.",
    funFacts: ["Sold as an unattributed Pop!-format vinyl", "Patched denim jacket is painted, not soft-goods", "Stands about four inches tall"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1781543423089-dc61428dbbfa.jpg",
  },
  {
    sku: "MNI-003",
    slug: "mystery-blind-box-pull",
    name: "Mystery Blind Box Pull",
    description: "One sealed pull from our blind-box wall. Anime, Marvel and Transformers super-deformed minis all sit in the same rotation, so the box decides.",
    price: 249900,
    cost: 110000,
    stockQuantity: 16,
    category: "custom-figures",
    franchise: "Blind Box",
    character: "Sealed pull",
    edition: "Exclusive",
    releaseDate: "2026-07-29",
    badges: ["FAN_FAVORITE", "PRE_ORDER"],
    characterStory: "The blind-box wall is the part of the shop people photograph. You pick a numbered cell, we pull the box sealed, and neither of us knows which mini is inside until you open it.",
    funFacts: ["Current rotation includes One Piece, Marvel and Transformers minis", "Boxes are pulled sealed and never pre-sorted", "Duplicates can be traded back in store credit"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1720630351963-93567f7a746d.jpg",
  },
  {
    sku: "AIC-003",
    slug: "samurai-musha-doll",
    name: "Samurai Musha Ningyō Doll",
    description: "A traditional Japanese musha ningyō display doll in lacquered lamellar armour with a gilded kabuto, silk brocade hakama and a drawn katana, on a black lacquer base.",
    price: 1499900,
    cost: 680000,
    stockQuantity: 8,
    category: "custom-figures",
    franchise: "Original Design",
    character: "Armoured Samurai",
    edition: "Exclusive",
    releaseDate: "2026-07-20",
    badges: ["PRE_ORDER"],
    characterStory: "Musha ningyō are the armoured warrior dolls traditionally displayed in Japan for Children's Day. This is a decorative piece rather than a character from any series — no franchise, no lore, just craft.",
    funFacts: ["Armour lacing and brocade are real textile, not moulded", "Ships on its own black lacquer display base", "Not tied to any anime or film licence"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1687865547203-f592769b9221.jpg",
  },
  {
    sku: "SPL-002",
    slug: "dread-reaper-statue",
    name: "Dread Reaper Statue",
    description: "An original-design dark knight statue — horned helm with red glass eyes, chainmail sleeves, a gilded pauldron and a blood-tipped scythe.",
    price: 1299900,
    cost: 590000,
    stockQuantity: 10,
    category: "custom-figures",
    franchise: "Original Design",
    character: "Dread Reaper",
    edition: "Exclusive",
    releaseDate: "2026-06-18",
    badges: ["LIMITED", "FAN_FAVORITE"],
    characterStory: "A studio original rather than a licensed character — a horned reaper knight cast in resin, drybrushed grey over black, with the only colour in the eyes and the blade.",
    funFacts: ["Original studio sculpt, no franchise tie", "Eyes and scythe edge are the only painted colour", "Chainmail texture is sculpted into the master, not a decal"],
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1753492644538-53ee68625f6d.jpg",
  },
];

type CollectionSeed = {
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number;
  imageUrl: string;
  items: { sku: string; quantity: number }[];
};

const COLLECTIONS: CollectionSeed[] = [
  {
    slug: "sandtrooper-squad-set",
    name: "Sandtrooper Squad Set",
    description: "The Desert Patrol trooper and the Squad Leader variant, sold together as the two-man detail they were sculpted to display alongside.",
    price: 1899900,
    compareAtPrice: 2099800,
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1623039902375-29258147f39e.jpg",
    items: [
      { sku: "KJC-001", quantity: 1 },
      { sku: "KJC-003", quantity: 1 },
    ],
  },
  {
    slug: "marvel-team-up-spider-man-falcon",
    name: "Marvel Team-Up: Spider-Man & Falcon",
    description: "Spider-Man in the classic red-and-blue suit paired with Sam Wilson's Falcon in his flight-ready pose — two Avengers-era mainstays for one shelf.",
    price: 1699900,
    compareAtPrice: 1899800,
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1529335764857-3f1164d1cb24.jpg",
    items: [
      { sku: "AIC-002", quantity: 1 },
      { sku: "KJC-002", quantity: 1 },
    ],
  },
  {
    slug: "shonen-icons-duo",
    name: "Shonen Icons Duo",
    description: "Tanjiro Kamado and Super Saiyan Goku, two of shonen anime's most recognisable leads, bundled as a starter pair for a new collector's shelf.",
    price: 699900,
    compareAtPrice: 799800,
    imageUrl: "https://uzdrfxatgdevbtopriwo.supabase.co/storage/v1/object/public/product-images/photo-1765633358993-c8a68fd47d6f.jpg",
    items: [
      { sku: "AIC-004", quantity: 1 },
      { sku: "AIC-001", quantity: 1 },
    ],
  },
];

/* The four badge codes the storefront shipped hardcoded. Seeding them with the
   exact labels and tones the old FigureBadge PRESET map used keeps every
   existing product looking identical once the storefront reads tags from the
   database instead. Rotation is not here on purpose: it is a per-sticker
   styling choice the storefront makes, not a property of the tag. */
const TAGS = [
  { code: "NEW", label: "just landed", tone: "yellow" },
  { code: "LIMITED", label: "limited run", tone: "orange" },
  { code: "PRE_ORDER", label: "pre-order", tone: "blue" },
  { code: "FAN_FAVORITE", label: "fan favourite", tone: "peach" },
];

async function main() {
  for (const tag of TAGS) {
    await prisma.tag.upsert({ where: { code: tag.code }, update: tag, create: tag });
  }

  const categoryIds = new Map<CategoryKey, string>();
  for (const category of CATEGORIES) {
    const data = { name: category.name, slug: category.slug, description: category.description };
    const row = await prisma.category.upsert({ where: { slug: category.slug }, update: data, create: data });
    categoryIds.set(category.key, row.id);
  }

  for (const product of PRODUCTS) {
    const { category, releaseDate, ...rest } = product;
    const data = { ...rest, categoryId: categoryIds.get(category)!, releaseDate: new Date(releaseDate) };
    await prisma.product.upsert({ where: { sku: product.sku }, update: data, create: data });
  }

  await prisma.category.deleteMany({ where: { slug: { in: RETIRED_CATEGORY_SLUGS } } });

  for (const collection of COLLECTIONS) {
    const { items, ...rest } = collection;
    const row = await prisma.collection.upsert({ where: { slug: collection.slug }, update: rest, create: rest });
    for (const item of items) {
      const product = await prisma.product.findUniqueOrThrow({ where: { sku: item.sku } });
      await prisma.collectionItem.upsert({
        where: { collectionId_productId: { collectionId: row.id, productId: product.id } },
        update: { quantity: item.quantity },
        create: { collectionId: row.id, productId: product.id, quantity: item.quantity },
      });
    }
  }

  await prisma.customer.upsert({
    where: { email: "demo@funkopie.store" },
    update: {},
    create: { name: "Demo Customer", email: "demo@funkopie.store", passwordHash: await bcrypt.hash("demo-password", 12), cart: { create: {} } },
  });
}

main().finally(() => prisma.$disconnect());
