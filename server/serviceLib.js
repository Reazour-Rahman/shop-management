// Service Sale helpers: MM -> Feet conversion and the calculation of one service invoice line.
// The same rules are copied in client/src/serviceLib.js (used for the live preview in the form).

const MM_PER_FT = 304.8;
const GRADES = ['A', 'B', 'C', 'AB', 'ABC'];

const num = v => Number(v) || 0;
const r2 = n => Math.round(n * 100) / 100;
const blank = v => v === undefined || v === null || String(v).trim() === '';
const text = v => String(v ?? '').trim();

// Customer-facing size: feet rounded UP to the next 0.5 ft (6.1 -> 6.5, anything above 6.5 -> 7).
// A tolerance of 0.01 ft (about 3 mm) is allowed, so 1981.8 mm (6.502 ft) stays 6.5 ft.
function toFeet(mm) {
  const v = Number(mm);
  if (!(v > 0)) return 0;
  return Math.max(0.5, Math.ceil((v / MM_PER_FT - 0.01) * 2) / 2);
}

// Builds one stored invoice line from what the operator typed.
// LTH and WTH are typed (and stored) in MM. QTY = LTH(ft) x WTH(ft) x PCS, using the rounded feet the customer sees.
function serviceLine(i) {
  const name = text(i.name);
  if (!name) throw new Error('Choose a service name for every row');
  const grade = text(i.grade).toUpperCase();
  if (grade && !GRADES.includes(grade)) throw new Error(`Grade for ${name} must be one of ${GRADES.join(', ')}`);

  // One item can have several window sizes. An old-style line (lthMm, wthMm, pcs on the item itself) counts as one size.
  const rawSizes = Array.isArray(i.sizes) && i.sizes.length ? i.sizes : [{ lthMm: i.lthMm, wthMm: i.wthMm, pcs: i.pcs }];
  const sizes = rawSizes.map(z => {
    const pcs = num(z.pcs);
    if (pcs <= 0) throw new Error(`Enter PCS for every size of ${name}`);
    const hasL = !blank(z.lthMm), hasW = !blank(z.wthMm);
    const lthMm = hasL ? num(z.lthMm) : null, wthMm = hasW ? num(z.wthMm) : null;
    if (hasL && lthMm <= 0) throw new Error(`Enter a valid LTH (mm) for ${name}`);
    if (hasW && wthMm <= 0) throw new Error(`Enter a valid WTH (mm) for ${name}`);
    const lthFt = hasL ? toFeet(lthMm) : null, wthFt = hasW ? toFeet(wthMm) : null;
    // A missing size counts as 1, so a service without LTH/WTH is charged per piece
    return { lthMm, wthMm, lthFt, wthFt, pcs, qty: r2((hasL ? lthFt : 1) * (hasW ? wthFt : 1) * pcs) };
  });
  const pcs = sizes.reduce((t, z) => t + z.pcs, 0), qty = r2(sizes.reduce((t, z) => t + z.qty, 0));
  const first = sizes[0];

  const price = num(i.price);
  if (price < 0) throw new Error(`Rate cannot be negative for ${name}`);
  const amount = r2(qty * price);

  const discountType = i.discountType === '%' ? '%' : '৳';
  const discountValue = num(i.discountValue);
  if (discountValue < 0) throw new Error(`Discount cannot be negative for ${name}`);
  if (discountType === '%' && discountValue > 100) throw new Error(`Discount for ${name} cannot be more than 100%`);
  const discount = discountType === '%' ? r2((amount * discountValue) / 100) : r2(discountValue);
  const total = r2(amount - discount);
  if (total < 0) throw new Error(`Discount is more than the amount for ${name}`);

  return {
    name, brand: text(i.brand), size: text(i.size), thickness: text(i.thickness), color: text(i.color), grade,
    unit: 'sq ft', sizes, lthMm: first.lthMm, wthMm: first.wthMm, lthFt: first.lthFt, wthFt: first.wthFt, pcs, qty, price, discount, discountType, discountValue, total,
    unitCost: 0, isService: true, isContract: false,
  };
}

module.exports = { MM_PER_FT, GRADES, toFeet, serviceLine };
