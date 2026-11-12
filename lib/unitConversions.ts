// Best-effort unit conversion for displaying ingredient amounts in the cook
// screen. The mobile app never implemented this (only had an unused
// `translations` field) — this is a fresh, practical implementation.

const WEIGHT_TO_GRAMS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilogram: 1000, kilograms: 1000,
  oz: 28.3495, ounce: 28.3495, ounces: 28.3495,
  lb: 453.592, lbs: 453.592, pound: 453.592, pounds: 453.592,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1,
  l: 1000, liter: 1000, liters: 1000,
  tsp: 4.92892, teaspoon: 4.92892, teaspoons: 4.92892,
  tbsp: 14.7868, tablespoon: 14.7868, tablespoons: 14.7868,
  cup: 236.588, cups: 236.588,
};

export type DisplayUnit = 'original' | 'g' | 'oz' | 'cup' | 'tbsp';

export const DISPLAY_UNIT_OPTIONS: { value: DisplayUnit; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'g', label: 'Grams' },
  { value: 'oz', label: 'Oz' },
  { value: 'cup', label: 'Cups' },
  { value: 'tbsp', label: 'Tbsp' },
];

/** Converts amount+unit to the target display unit. Falls back to the original when units are incompatible (e.g. "clove", "pinch") or the target is weight/volume but the source is the other kind. */
export function convertToDisplayUnit(
  amount: string | number,
  unit: string | undefined,
  target: DisplayUnit,
): { amount: string; unit: string } {
  const original = { amount: String(amount ?? ''), unit: unit ?? '' };
  if (target === 'original' || !unit) return original;

  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (Number.isNaN(num)) return original;

  const key = unit.trim().toLowerCase();
  const isWeight = key in WEIGHT_TO_GRAMS;
  const isVolume = key in VOLUME_TO_ML;
  if (!isWeight && !isVolume) return original;

  const wantsWeight = target === 'g' || target === 'oz';
  if (wantsWeight && !isWeight) return original;
  if (!wantsWeight && !isVolume) return original;

  const format = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(2).replace(/\.00$/, ''));

  if (wantsWeight) {
    const grams = num * WEIGHT_TO_GRAMS[key];
    return target === 'g'
      ? { amount: format(grams), unit: 'g' }
      : { amount: format(grams / WEIGHT_TO_GRAMS.oz), unit: 'oz' };
  }

  const ml = num * VOLUME_TO_ML[key];
  return target === 'cup'
    ? { amount: format(ml / VOLUME_TO_ML.cup), unit: 'cup' }
    : { amount: format(ml / VOLUME_TO_ML.tbsp), unit: 'tbsp' };
}
