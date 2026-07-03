import type { Entity, WorldState } from '../types';
import { makeEntity } from './entities';
import { demoMap, PARTY_SPAWN, ENEMY_SPAWN, MONSTERS } from '../data';

export function createDemoWorld(): WorldState {
  const map = demoMap(30, 17);

  const heroes: Entity[] = PARTY_SPAWN.map((p) =>
    makeEntity({
      id: p.id,
      faction: p.faction,
      name: p.name,
      sprite: p.sprite,
      cell: { ...p.cell },
      level: p.level,
      jobId: p.jobId,
    }),
  );

  const enemies: Entity[] = ENEMY_SPAWN.map((spec, i) => {
    const m = MONSTERS[spec.monster];
    return makeEntity({
      id: 'e' + i,
      faction: 'enemy',
      name: m.name,
      sprite: m.sprite,
      cell: { ...spec.cell },
      level: spec.level,
      jobId: m.id,
      growth: m.growth,
      skills: m.skills,
      elite: m.elite,
    });
  });

  const all = [...heroes, ...enemies];
  return {
    map,
    entities: Object.fromEntries(all.map((e) => [e.id, e])),
    groups: {},
    playerId: 'p1',
    seq: 0,
    tickCount: 0,
  };
}
