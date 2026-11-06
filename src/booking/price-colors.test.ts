import { expect, it } from 'vitest';
import { priceLegend } from './price-colors';

it('sorts numeric labels before text, breaks ties by label and leaves input intact', () => {
  const names = ['Club', '10.50', '2B', '2A'];
  const source = names.map((name, id) => ({ id, name }));
  const legend = priceLegend(source, [
    ['a', 'b', 'c'],
    ['w', 'x', 'y', 'z'],
  ]);
  expect(legend.map((p) => [p.name, p.color])).toEqual([
    ['2A', 'w'],
    ['2B', 'x'],
    ['10.50', 'y'],
    ['Club', 'z'],
  ]);
  expect(source.map((p) => p.name)).toEqual(names);
  expect(priceLegend(source, [['low', 'high']]).map((p) => p.color)).toEqual([
    'low',
    'high',
    'high',
    'high',
  ]);
});
