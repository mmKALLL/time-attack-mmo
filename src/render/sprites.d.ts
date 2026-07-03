export type SpriteDir = { id: string; outline: string; thick: number; sat: number; bri: number };
export const Sprites: {
  build(name: string, frame: number, dir: SpriteDir): HTMLCanvasElement;
  draw(
    ctx: CanvasRenderingContext2D,
    name: string,
    frame: number,
    px: number,
    py: number,
    dirId: string,
    opts?: { cell?: number; bob?: number; shadow?: boolean },
  ): void;
  DIRS: Record<'A' | 'B' | 'C', SpriteDir>;
  list: string[];
  N: number;
};
