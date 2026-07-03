import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../store';

describe('game store', () => {
  beforeEach(() => useGame.getState().reset());
  it('starts on the dungeon scene with a demo world', () => {
    const st = useGame.getState();
    expect(st.scene).toBe('dungeon');
    expect(Object.keys(st.world.entities).length).toBeGreaterThan(0);
  });
  it('switches scenes', () => {
    useGame.getState().setScene('shop');
    expect(useGame.getState().scene).toBe('shop');
  });
  it('advance() drains the input queue into the engine', () => {
    const start = useGame.getState().world.entities.p1.cell.x;
    useGame.getState().enqueue({ type: 'move', dir: 'right' });
    useGame.getState().advance(50);
    expect(useGame.getState().world.entities.p1.cell.x).toBe(start + 1);
    expect(useGame.getState().inputQueue).toHaveLength(0);
  });
});
