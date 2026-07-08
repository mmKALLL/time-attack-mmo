// Shared player class art: sheet layout + the neutral-gray background keying,
// used by both the world renderer (Pixi textures) and the HUD portraits (canvas).
const ASSET_URLS = import.meta.glob('../../assets/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
function assetUrl(filename: string): string | undefined {
  for (const [k, v] of Object.entries(ASSET_URLS)) if (k.endsWith('/' + filename)) return v;
  return undefined;
}

export const PLAYER_SHEET = 'player-classes.png'; // 4x4 grid of 512px class portraits
export const PLAYER_BEGINNER = 'player-classes-beginner.png'; // standalone 512px image
export const PLAYER_TILE_SRC = 512;
// class -> tile index (reading order) in player-classes.png
export const PLAYER_CLASS_INDEX: Record<string, number> = {
  fighter: 0, knight: 1, paladin: 2, duelist: 3,
  archer: 4, hunter: 5, sniper: 6, ranger: 7,
  magician: 8, arcanist: 9, wizard: 10, druid: 11,
  rogue: 12, assassin: 13, shadower: 14, ninja: 15,
};

// A job's class portrait: which sheet + source rect (512px), or null when the
// job has no art (e.g. a fusion) so callers can fall back.
export function playerTile(jobId: string): { filename: string; sx: number; sy: number } | null {
  if (jobId === 'beginner') return { filename: PLAYER_BEGINNER, sx: 0, sy: 0 };
  const idx = PLAYER_CLASS_INDEX[jobId];
  if (idx === undefined) return null;
  return { filename: PLAYER_SHEET, sx: (idx % 4) * PLAYER_TILE_SRC, sy: Math.floor(idx / 4) * PLAYER_TILE_SRC };
}

// Player sheets sit on a flat neutral-gray background (sampled from the top-left
// pixel). Keying it needs care: the gray overlaps silver armor, so (1) only zero
// flat *neutral* bg-colored pixels (bow gaps etc.) — colored sprite bodies survive
// — and (2) flood-fill the open background + soft edges from the borders.
export function keyOutCornerBg(img: ImageData) {
  const { data, width, height } = img;
  const br = data[0];
  const bgc = data[1];
  const bb = data[2];
  const near = (i: number, tol: number) => Math.abs(data[i] - br) <= tol && Math.abs(data[i + 1] - bgc) <= tol && Math.abs(data[i + 2] - bb) <= tol;
  const neutral = (i: number) => Math.abs(data[i] - data[i + 1]) < 10 && Math.abs(data[i + 1] - data[i + 2]) < 10;

  for (let i = 0; i < data.length; i += 4) if (near(i, 16) && neutral(i)) data[i + 3] = 0;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (data[i + 3] !== 0 && !near(i, 42)) continue;
    data[i + 3] = 0;
    const x = p % width;
    const y = (p / width) | 0;
    if (x + 1 < width) stack.push(p + 1);
    if (x - 1 >= 0) stack.push(p - 1);
    if (y + 1 < height) stack.push(p + width);
    if (y - 1 >= 0) stack.push(p - width);
  }
}

// Background-keyed full sheet as a canvas, cached so the pass runs once per file.
const keyedCache = new Map<string, HTMLCanvasElement>();
const keyedLoading = new Map<string, Promise<HTMLCanvasElement | null>>();
export function keyedSheet(filename: string): Promise<HTMLCanvasElement | null> {
  const cached = keyedCache.get(filename);
  if (cached) return Promise.resolve(cached);
  let p = keyedLoading.get(filename);
  if (!p) {
    p = (async () => {
      const url = assetUrl(filename);
      if (!url) return null;
      const img = new Image();
      img.src = url;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height);
      keyOutCornerBg(data);
      ctx.putImageData(data, 0, 0);
      keyedCache.set(filename, cv);
      return cv;
    })();
    keyedLoading.set(filename, p);
  }
  return p;
}
