import { describe, it, expect } from 'vitest';
import { MAPS } from '../data-map';

const nameOf = (id: string) => MAPS[id].name;
const chainNames = (prefix: string) =>
  Object.keys(MAPS)
    .filter((id) => new RegExp(`^${prefix}_\\d+$`).test(id))
    .sort()
    .map(nameOf);

describe('in-between field map names', () => {
  it('names the 3-map Mäntyharju↔Savonlinna forest chain by nearer town + outward index', () => {
    // N=3, forest: i0,i1 -> Mäntyharju (idx 1,2); i2 ties toward b (distA=2,distB=0) -> Savonlinna idx 1.
    expect(chainNames('mantyharju_savonlinna')).toEqual(['Mäntyharju Forest', 'Mäntyharju Forest 2', 'Savonlinna Forest']);
  });

  it('uses each map’s own biome label in a mixed chain (Kuopio↔Kajaani)', () => {
    // N=3, biomes lake/forest/forest: i0 lake -> Kuopio, i1 forest -> Kuopio idx 2, i2 forest -> Kajaani idx 1.
    expect(chainNames('kuopio_kajaani')).toEqual(['Kuopio Lake', 'Kuopio Forest 2', 'Kajaani Forest']);
  });

  it('drops the numeric suffix only for index 1 (adjacent to the owner town)', () => {
    expect(nameOf('mantyharju_savonlinna_0')).toBe('Mäntyharju Forest');
    expect(nameOf('mantyharju_savonlinna_1')).toBe('Mäntyharju Forest 2');
  });

  it('splits an even-length chain evenly with no middle tie (Varkaus↔Jyväskylä, N=2)', () => {
    // N=2: i0 -> Varkaus (idx 1), i1 -> Jyväskylä (idx 1). Even split, both index 1.
    expect(chainNames('varkaus_jyvaskyla')).toEqual(['Varkaus Forest', 'Jyväskylä Forest']);
  });

  it('gives the middle of an odd-length chain to the `a` town (distance tie → earlier town)', () => {
    // The 5-map worked example from the card: N=5 forest, a=Mäntyharju, b=Savonlinna.
    // i=2 ties (distA=2,distB=2) and must go to Mäntyharju as index 3.
    const names = Array.from({ length: 5 }, (_, i) => {
      const distFromA = i;
      const distFromB = 5 - 1 - i;
      const ownerIsA = distFromA <= distFromB;
      const town = ownerIsA ? 'Mäntyharju' : 'Savonlinna';
      const index = ownerIsA ? i + 1 : 5 - i;
      return index === 1 ? `${town} Forest` : `${town} Forest ${index}`;
    });
    expect(names).toEqual(['Mäntyharju Forest', 'Mäntyharju Forest 2', 'Mäntyharju Forest 3', 'Savonlinna Forest 2', 'Savonlinna Forest']);
  });

  it('leaves the Lieksa dungeon chain and towns on their own names (not EDGES-generated)', () => {
    expect(nameOf('lieksa')).toBe('Lieksa Deepwood');
    expect(nameOf('lieksa2')).toBe('Deep forest · Lv 25–29'); // field() default, no EDGES rename
    expect(nameOf('mantyharju')).toBe('Mäntyharju');
  });
});
