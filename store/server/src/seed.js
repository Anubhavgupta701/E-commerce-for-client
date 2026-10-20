// Seed demo catalog, users, roles, coupon and settings. Safe to re-run: skips when data exists.
import { load, col, getSettings, setSettings, saveSync } from './db.js';
import { uid, slugify, nowIso, hashPassword } from './util.js';

load();

function seed() {
  if (col('products').length > 0) {
    console.log('Seed skipped: products already exist.');
    return;
  }
  const t = nowIso();

  const categories = [
    { id: uid('cat_'), name: 'Apparel', slug: 'apparel', active: true, sort: 1 },
    { id: uid('cat_'), name: 'Home & Living', slug: 'home', active: true, sort: 2 },
    { id: uid('cat_'), name: 'Accessories', slug: 'accessories', active: true, sort: 3 },
  ];
  col('categories').push(...categories);
  const catId = (slug) => categories.find((c) => c.slug === slug).id;

  // pricePaise / compareAtPaise are integers — never floats for money.
  const P = (title, slug, categorySlug, brand, desc, basePaise, mrpPaise, stock, attrs, img) => ({
    id: uid('prod_'),
    title,
    slug: slug || slugify(title),
    description: desc,
    brand,
    categoryId: catId(categorySlug),
    status: 'ACTIVE',
    createdAt: t,
    updatedAt: t,
    media: [{ key: img, alt: title, sort: 0 }],
    variants: attrs.map((a, i) => ({
      sku: `${slugify(title).slice(0, 6).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      attributes: a,
      pricePaise: basePaise,
      compareAtPaise: mrpPaise,
      stock,
    })),
  });

  const products = [
    P('Everyday Linen Shirt', null, 'apparel', 'Khaas', 'Breathable pure-linen shirt with a relaxed fit, corozo buttons and a clean camp collar. Pre-washed for softness.', 189900, 249900, 40,
      [{ size: 'S' }, { size: 'M' }, { size: 'L' }, { size: 'XL' }], 'img/linen-shirt.jpg'),
    P('Handloom Cotton Kurta', null, 'apparel', 'Khaas', 'Handloom cotton kurta in a warm earthy tone, side slits and wooden buttons. Made by artisan clusters.', 149900, 199900, 35,
      [{ size: 'S' }, { size: 'M' }, { size: 'L' }], 'img/kurta.jpg'),
    P('Raw Denim Jeans', null, 'apparel', 'Khaas', '14oz Japanese-style raw denim, straight fit, chain-stitched hems. Ages beautifully with wear.', 229900, 299900, 30,
      [{ size: '30' }, { size: '32' }, { size: '34' }], 'img/denim.jpg'),
    P('Merino Wool Sweater', null, 'apparel', 'Khaas', 'Featherlight merino crew-neck sweater, fully-fashioned knit. Naturally temperature-regulating.', 279900, 349900, 25,
      [{ size: 'M' }, { size: 'L' }, { size: 'XL' }], 'img/sweater.jpg'),
    P('Stoneware Dinner Set (16 pc)', null, 'home', 'Khaas Home', 'Reactive-glaze stoneware dinner set for four — dinner plates, side plates, bowls and mugs in a warm sand finish.', 399900, 549900, 20,
      [{ set: '16 piece' }], 'img/dinner-set.jpg'),
    P('Brass Table Lamp', null, 'home', 'Khaas Home', 'Spun-brass table lamp with a handwoven cane shade. Warm 2700K glow, inline dimmer switch.', 249900, 329900, 18,
      [{ finish: 'Antique brass' }], 'img/lamp.jpg'),
    P('Handwoven Throw Blanket', null, 'home', 'Khaas Home', 'Chunky handwoven throw in undyed wool and cotton, fringed edges. Looms of Kutch.', 179900, 229900, 28,
      [{ color: 'Natural' }, { color: 'Rust' }], 'img/throw.jpg'),
    P('Ceramic Pour-Over Set', null, 'home', 'Khaas Home', 'Complete pour-over coffee ritual: dripper, carafe and walnut collar, in matte ceramic.', 159900, 199900, 32,
      [{ set: 'Dripper + carafe' }], 'img/pour-over.jpg'),
    P('Full-Grain Leather Wallet', null, 'accessories', 'Khaas', 'Six-card bifold in full-grain vegetable-tanned leather. Develops a rich patina.', 129900, 169900, 50,
      [{ color: 'Tan' }, { color: 'Espresso' }], 'img/wallet.jpg'),
    P('Canvas Weekender Bag', null, 'accessories', 'Khaas', 'Waxed canvas weekender with leather trims, brass zips and a separate shoe compartment.', 349900, 449900, 15,
      [{ color: 'Field tan' }], 'img/weekender.jpg'),
    P('Block-Print Silk Scarf', null, 'accessories', 'Khaas', 'Hand block-printed mulberry silk scarf, 180x70cm. Each piece slightly unique.', 99900, 139900, 45,
      [{ color: 'Indigo' }, { color: 'Maroon' }], 'img/scarf.jpg'),
    P('Copper Water Carafe Set', null, 'home', 'Khaas Home', 'Hammered pure-copper carafe with tumbler lid. Traditional craftsmanship, lacquered exterior.', 119900, 159900, 38,
      [{ set: 'Carafe + tumbler' }], 'img/carafe.jpg'),
  ];
  col('products').push(...products);

  // Users + roles
  const mkUser = (name, email, phone, username, password) => {
    const u = {
      id: uid('user_'), name, email, phone,
      username: username || undefined,
      passwordHash: password ? hashPassword(password) : undefined,
      emailVerified: true, phoneVerified: true, status: 'ACTIVE', createdAt: t,
    };
    col('users').push(u);
    return u;
  };
  const superadmin = mkUser('Store Owner', 'owner@khaas.in', '919999999999', 'superadmin', 'SuperAdmin@123');
  const admin = mkUser('Catalog Manager', 'catalog@khaas.in', '919888888888', 'admin', 'Admin@123');
  const grant = (user, role, by) => col('roleAssignments').push({ id: uid('ra_'), userId: user.id, role, grantedBy: by, createdAt: t });
  grant(superadmin, 'SUPERADMIN', 'seed');
  grant(admin, 'ADMIN', superadmin.id);

  col('coupons').push({
    id: uid('cpn_'), code: 'WELCOME10', kind: 'percent', value: 10, maxDiscountPaise: 50000,
    minSubtotalPaise: 99900, active: true, startsAt: t, endsAt: null, usageLimit: 1000, usedCount: 0,
    createdAt: t,
  });

  setSettings({
    brandName: 'Mahi Green World',
    tagline: "Nature's best, sustainably crafted.",
    currency: 'INR',
    currencySymbol: '₹',
    supportEmail: 'care@mahigreenworld.com',
    supportPhone: '+91 99999 99999',
    shippingFlatPaise: 9900,
    freeShippingAbovePaise: 199900,
    taxPercent: 0,
    codEnabled: true,
    qrEnabled: true,
    qrUpiId: 'mahigreenworld@upi',
    qrPayeeName: 'Mahi Green World',
    qrInstructions: 'Pay the exact order amount to the UPI ID below using any UPI app (GPay / PhonePe / Paytm). After paying, submit your UTR / transaction reference ID here. Your order ships only after our team verifies the payment.',
    announcement: '🌱 Free shipping across India on orders above ₹1,999 · Eco-friendly & Plastic-Free Delivery',
    returnDays: 7,
  });

  saveSync();
  console.log(`Seeded ${products.length} products, 2 staff users, 1 coupon, settings.`);
  console.log('Superadmin login: owner@khaas.in (OTP, dev code visible in API response)');
  console.log('Admin login: catalog@khaas.in (OTP, dev code visible in API response)');
}

seed();
