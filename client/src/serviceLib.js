// Service Sale helpers for the form preview. The same rules run on the server (server/serviceLib.js),
// and the server's result is what gets saved. Keep both files in step.

export const MM_PER_FT = 304.8;
export const GRADES = ["A", "B", "C", "AB", "ABC"];

const num = (v) => Number(v) || 0;
const r2 = (n) => Math.round(n * 100) / 100;
const blank = (v) =>
  v === undefined || v === null || String(v).trim() === "";

// Customer-facing size: feet rounded UP to the next 0.5 ft (6.1 -> 6.5, above 6.5 -> 7).
// 0.01 ft (about 3 mm) of tolerance keeps 1981.8 mm at 6.5 ft.
export function toFeet(mm) {
  const v = Number(mm);
  if (!(v > 0)) return 0;
  return Math.max(0.5, Math.ceil((v / MM_PER_FT - 0.01) * 2) / 2);
}

// Shows 4 as "4" and 6.5 as "6.5"
export const fmtFt = (x) =>
  x === null || x === undefined || x === "" ? "" : String(Number(x));

// An item can have several window sizes: it.sizes = [{ lthMm, wthMm, pcs }, ...]
export const blankSize = () => ({ lthMm: "", wthMm: "", pcs: "" });

// Live numbers for one size line
export function sizeCalc(z) {
  const hasL = !blank(z.lthMm),
    hasW = !blank(z.wthMm);
  const lthFt = hasL ? toFeet(z.lthMm) : null,
    wthFt = hasW ? toFeet(z.wthMm) : null;
  const qty = r2((hasL ? lthFt : 1) * (hasW ? wthFt : 1) * num(z.pcs));
  return { lthFt, wthFt, qty };
}

// Live numbers for one row of the Service Sale form: QTY is the sum of all its size lines
export function serviceCalc(it) {
  const sizes = (it.sizes || []).map(sizeCalc);
  const qty = r2(sizes.reduce((t, z) => t + z.qty, 0));
  const amount = r2(qty * num(it.price));
  const dv = num(it.discountValue);
  const discount = it.discountType === "%" ? r2((amount * dv) / 100) : r2(dv);
  return { sizes, qty, amount, discount, total: Math.max(0, r2(amount - discount)) };
}
