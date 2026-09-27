// Money is stored as paise (integer). Weight as milligrams. Display helpers below.

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function fmtPaise(paise: number): string {
  return `₹${inr.format(paise / 100)}`;
}

export function fmtGrams(mg: number, dp = 3): string {
  return `${(mg / 1000).toFixed(dp)} g`;
}

export function fmtCarat(mg: number, dp = 3): string {
  return `${(mg / 200).toFixed(dp)} ct`;
}

export function gramsToMg(g: number): number {
  return Math.round(g * 1000);
}
export function caratToMg(c: number): number {
  return Math.round(c * 200);
}
export function rupeesToPaise(r: number): number {
  return Math.round(r * 100);
}
