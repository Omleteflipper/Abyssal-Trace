import type { ToolId, VisitorId } from './content';
export const assets = {
  office: 'assets/backgrounds/office.svg', exterior: 'assets/backgrounds/exterior.svg', logo: 'assets/title.svg',
  portraits: Object.fromEntries(['mira', 'vela', 'rook', 'nacre'].map(id => [id, { path: `assets/characters/${id}.svg`, left: 2, top: 11, width: 46, height: 80, fit: 'contain' as const, origin: 'center bottom' }])) as Record<VisitorId, { path: string; left: number; top: number; width: number; height: number; fit: 'contain' | 'cover'; origin: string }>,
  hotspots: {
    recovery: { left: 10, top: 43, width: 28, height: 33, overlay: null as string | null },
    signal: { left: 67, top: 37, width: 24, height: 30, overlay: null as string | null },
    compare: { left: 68, top: 70, width: 25, height: 20, overlay: null as string | null },
  } satisfies Record<ToolId, { left: number; top: number; width: number; height: number; overlay: string | null }>,
  door: { left: 42, top: 21, width: 18, height: 48 },
};
export const assetUrl = (path: string) => import.meta.env.BASE_URL + path;
