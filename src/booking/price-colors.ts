import type { IPriceDTO } from './api-types.js';
import type { IColoredPrice } from './settings.js';

const blue = '#2196F3',
  amber = '#FFC107',
  violet = '#673AB7';
const spectrum = [
  '#9C27B0',
  violet,
  '#3F51B5',
  blue,
  '#00BCD4',
  '#009688',
  '#4CAF50',
  '#CDDC39',
  amber,
  '#FF9800',
  '#FF5722',
  '#F44336',
  '#E91E63',
];

export function priceLegend(
  prices: readonly IPriceDTO[],
  palettes: string[][] = [spectrum, [blue], [blue, amber], [violet, blue, amber]],
): IColoredPrice[] {
  const ranked = prices.map((price) => {
    const number = Number.parseInt(price.name);
    return { price, rank: Number.isFinite(number) ? number : Infinity };
  });
  ranked.sort(
    (left, right) =>
      left.rank - right.rank ||
      Number(left.price.name > right.price.name) - Number(left.price.name < right.price.name),
  );
  const palette = palettes.find((colors) => colors.length === ranked.length) ?? palettes[0] ?? [];
  return ranked.map(({ price }, i) => {
    const slot = Math.round((i * palette.length) / ranked.length);
    return { ...price, color: palette[Math.min(palette.length - 1, slot)]! };
  });
}
