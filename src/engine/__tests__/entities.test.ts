import { describe, it, expect } from 'vitest';
import { makeEntity, isAlive, areEnemies } from '../entities';

const hero = makeEntity({ id: 'p1', faction: 'player', name: 'Hero', sprite: 'ranger', cell: { x: 1, y: 1 }, level: 25, jobId: 'beginner' });
const rat = makeEntity({ id: 'e1', faction: 'enemy', name: 'Rat', sprite: 'slime', cell: { x: 2, y: 1 }, level: 25, jobId: 'beginner' });

describe('entities', () => {
  it('starts at full hp/mp derived from stats', () => {
    expect(hero.hp).toBe(hero.stats.maxHp);
    expect(hero.mp).toBe(hero.stats.maxMp);
    expect(hero.stats.maxHp).toBeGreaterThan(0);
  });
  it('grants the job’s skills as runtime slots (unlimited uses => -1)', () => {
    expect(hero.skills[0].skillId).toBe('strike');
    expect(hero.skills[0].usesLeft).toBe(-1);
  });
  it('same level + same job => symmetric stats for player and enemy', () => {
    expect(hero.stats).toEqual(rat.stats);
  });
  it('detects living entities', () => {
    expect(isAlive(hero)).toBe(true);
    expect(isAlive({ ...hero, hp: 0 })).toBe(false);
  });
  it('players and enemies are mutual enemies; players and allies are not', () => {
    const ally = makeEntity({ id: 'a1', faction: 'ally', name: 'Ally', sprite: 'knight', cell: { x: 0, y: 0 }, level: 25, jobId: 'beginner' });
    expect(areEnemies(hero, rat)).toBe(true);
    expect(areEnemies(hero, ally)).toBe(false);
  });
  it('monster factory takes explicit growth + skills without a JOBS entry', () => {
    const golem = makeEntity({ id: 'g', faction: 'enemy', name: 'Golem', sprite: 'golem', cell: { x: 5, y: 5 }, level: 25, jobId: 'golem', growth: 1.3, skillIds: ['boulderSmash'], elite: true });
    expect(golem.skills[0].skillId).toBe('boulderSmash');
    expect(golem.elite).toBe(true);
    expect(golem.stats.maxHp).toBeGreaterThan(hero.stats.maxHp); // higher growth
  });
});
