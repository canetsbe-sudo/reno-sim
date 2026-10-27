// Static game content: finishes, furniture, hidden issues and scenarios.

export type Tone = 'warm' | 'cool' | 'neutral';
export type Style = 'classic' | 'modern' | 'midcentury' | 'coastal' | 'farmhouse';

export type FinishCategory = 'floor' | 'wall' | 'cabinet' | 'counter' | 'backsplash' | 'window' | 'lighting';

export interface Finish {
  id: string;
  category: FinishCategory;
  name: string;
  color: string;
  accent?: string;
  pattern?: 'planks' | 'checker' | 'tile' | 'stripes' | 'floral' | 'speckle' | 'subway' | 'herringbone' | 'zellige' | 'cement' | 'none';
  // Material cost: per floor tile, per wall, per cabinet, per counter along a wall, or per window.
  cost: number;
  // Crew days for the whole room.
  labor: number;
  tone: Tone;
  styles: Style[];
  // Old finishes only appear in the "before" room and are never offered.
  old?: boolean;
}

export const FINISHES: Finish[] = [
  // Floors (cost per tile)
  { id: 'floor-oak', category: 'floor', name: 'Oak planks', color: '#c8955c', accent: '#a87843', pattern: 'planks', cost: 45, labor: 3, tone: 'warm', styles: ['classic', 'farmhouse'] },
  { id: 'floor-walnut', category: 'floor', name: 'Walnut planks', color: '#7a5034', accent: '#5e3c26', pattern: 'planks', cost: 70, labor: 3, tone: 'warm', styles: ['midcentury', 'classic'] },
  { id: 'floor-whitewash', category: 'floor', name: 'Whitewashed pine', color: '#e3d8c6', accent: '#cbbda6', pattern: 'planks', cost: 40, labor: 3, tone: 'neutral', styles: ['coastal', 'farmhouse'] },
  { id: 'floor-checker', category: 'floor', name: 'Checkerboard tile', color: '#f3efe7', accent: '#2f3135', pattern: 'checker', cost: 35, labor: 4, tone: 'neutral', styles: ['classic', 'midcentury'] },
  { id: 'floor-terracotta', category: 'floor', name: 'Terracotta tile', color: '#c56b45', accent: '#a9583a', pattern: 'tile', cost: 30, labor: 4, tone: 'warm', styles: ['farmhouse'] },
  { id: 'floor-slate', category: 'floor', name: 'Slate tile', color: '#5f6870', accent: '#4c545b', pattern: 'tile', cost: 55, labor: 4, tone: 'cool', styles: ['modern'] },
  { id: 'floor-vinyl', category: 'floor', name: 'Click-together vinyl', color: '#b9a48a', accent: '#a38e74', pattern: 'planks', cost: 18, labor: 1, tone: 'neutral', styles: ['modern'] },
  { id: 'floor-old-lino', category: 'floor', name: 'Worn linoleum', color: '#c9b77a', accent: '#a99a63', pattern: 'speckle', cost: 0, labor: 0, tone: 'warm', styles: [], old: true },
  { id: 'floor-old-carpet', category: 'floor', name: 'Stained carpet', color: '#8a7f6a', accent: '#6f6553', pattern: 'speckle', cost: 0, labor: 0, tone: 'warm', styles: [], old: true },
  { id: 'floor-subfloor', category: 'floor', name: 'Bare subfloor', color: '#d2b48c', accent: '#b89a72', pattern: 'tile', cost: 0, labor: 0, tone: 'neutral', styles: [], old: true },

  // Walls (cost per wall)
  { id: 'wall-cream', category: 'wall', name: 'Cream paint', color: '#f1e6cf', cost: 120, labor: 1, tone: 'warm', styles: ['classic', 'farmhouse'] },
  { id: 'wall-sage', category: 'wall', name: 'Sage green paint', color: '#a9b99a', cost: 120, labor: 1, tone: 'neutral', styles: ['farmhouse', 'classic'] },
  { id: 'wall-seafoam', category: 'wall', name: 'Seafoam paint', color: '#a8d3cc', cost: 120, labor: 1, tone: 'cool', styles: ['coastal'] },
  { id: 'wall-navy', category: 'wall', name: 'Navy paint', color: '#34466b', cost: 140, labor: 1, tone: 'cool', styles: ['coastal', 'modern'] },
  { id: 'wall-mustard', category: 'wall', name: 'Mustard paint', color: '#d9a441', cost: 130, labor: 1, tone: 'warm', styles: ['midcentury'] },
  { id: 'wall-white', category: 'wall', name: 'Gallery white', color: '#f7f5f0', cost: 100, labor: 1, tone: 'neutral', styles: ['modern', 'coastal'] },
  { id: 'wall-stripe', category: 'wall', name: 'Ticking stripe wallpaper', color: '#eef0f2', accent: '#8fa6bf', pattern: 'stripes', cost: 380, labor: 2, tone: 'cool', styles: ['coastal', 'classic'] },
  { id: 'wall-shiplap', category: 'wall', name: 'White shiplap', color: '#f4f1ea', accent: '#d9d3c6', pattern: 'planks', cost: 450, labor: 2, tone: 'neutral', styles: ['farmhouse', 'coastal'] },
  { id: 'wall-old-floral', category: 'wall', name: 'Faded floral wallpaper', color: '#d8c3a5', accent: '#b0796b', pattern: 'floral', cost: 0, labor: 0, tone: 'warm', styles: [], old: true },
  { id: 'wall-old-grime', category: 'wall', name: 'Grimy paint', color: '#b5ad98', cost: 0, labor: 0, tone: 'neutral', styles: [], old: true },
  { id: 'wall-drywall', category: 'wall', name: 'Bare drywall', color: '#dcdad3', cost: 0, labor: 0, tone: 'neutral', styles: [], old: true },

  // Cabinets (cost per cabinet piece)
  { id: 'cab-shaker-white', category: 'cabinet', name: 'White shaker', color: '#f2efe8', accent: '#d7d1c4', cost: 260, labor: 2, tone: 'neutral', styles: ['classic', 'farmhouse', 'coastal'] },
  { id: 'cab-shaker-green', category: 'cabinet', name: 'Forest green shaker', color: '#3f5d48', accent: '#304a39', cost: 300, labor: 2, tone: 'warm', styles: ['farmhouse', 'classic'] },
  { id: 'cab-teak', category: 'cabinet', name: 'Teak flat-front', color: '#a5683a', accent: '#8a552e', cost: 340, labor: 2, tone: 'warm', styles: ['midcentury'] },
  { id: 'cab-navy', category: 'cabinet', name: 'Navy flat-front', color: '#2f4063', accent: '#24324e', cost: 300, labor: 2, tone: 'cool', styles: ['modern', 'coastal'] },
  { id: 'cab-oak', category: 'cabinet', name: 'Natural oak', color: '#cfa36d', accent: '#b2884f', cost: 280, labor: 2, tone: 'warm', styles: ['farmhouse', 'midcentury'] },
  { id: 'cab-old-laminate', category: 'cabinet', name: 'Peeling laminate', color: '#bfa57f', accent: '#9e8662', cost: 0, labor: 0, tone: 'warm', styles: [], old: true },

  // Counters (cost per counter-topped piece)
  { id: 'ctr-butcher', category: 'counter', name: 'Butcher block', color: '#c99460', cost: 140, labor: 1, tone: 'warm', styles: ['farmhouse', 'classic'] },
  { id: 'ctr-marble', category: 'counter', name: 'Marble', color: '#f1f0ee', accent: '#c9c9cc', cost: 420, labor: 2, tone: 'cool', styles: ['classic', 'modern', 'coastal'] },
  { id: 'ctr-concrete', category: 'counter', name: 'Concrete', color: '#a9a9a4', cost: 220, labor: 2, tone: 'cool', styles: ['modern'] },
  { id: 'ctr-terrazzo', category: 'counter', name: 'Terrazzo', color: '#e9e1d6', accent: '#d27b5a', pattern: 'speckle', cost: 300, labor: 2, tone: 'warm', styles: ['midcentury'] },
  { id: 'ctr-laminate', category: 'counter', name: 'Budget laminate', color: '#d9d3c7', cost: 50, labor: 1, tone: 'neutral', styles: ['modern'] },
  { id: 'ctr-old-formica', category: 'counter', name: 'Chipped formica', color: '#d6c48f', cost: 0, labor: 0, tone: 'warm', styles: [], old: true },

  // Backsplash (cost per counter piece against a wall)
  { id: 'bs-none', category: 'backsplash', name: 'None, just paint', color: '#e8e2d6', cost: 0, labor: 0, tone: 'neutral', styles: [] },
  { id: 'bs-subway', category: 'backsplash', name: 'White subway tile', color: '#f7f6f2', accent: '#cfcac0', pattern: 'subway', cost: 90, labor: 2, tone: 'neutral', styles: ['classic', 'farmhouse', 'modern', 'coastal'] },
  { id: 'bs-zellige', category: 'backsplash', name: 'Green zellige', color: '#5f8a6e', accent: '#4b735a', pattern: 'zellige', cost: 160, labor: 2, tone: 'warm', styles: ['farmhouse', 'classic'] },
  { id: 'bs-blue-zellige', category: 'backsplash', name: 'Sea blue zellige', color: '#5d8fae', accent: '#4a7896', pattern: 'zellige', cost: 160, labor: 2, tone: 'cool', styles: ['coastal'] },
  { id: 'bs-herringbone', category: 'backsplash', name: 'Marble herringbone', color: '#efeeec', accent: '#c4c4c8', pattern: 'herringbone', cost: 220, labor: 3, tone: 'cool', styles: ['classic', 'modern'] },
  { id: 'bs-cement', category: 'backsplash', name: 'Patterned cement tile', color: '#e9dfcf', accent: '#c2683f', pattern: 'cement', cost: 140, labor: 2, tone: 'warm', styles: ['midcentury', 'farmhouse'] },
  { id: 'bs-mustard', category: 'backsplash', name: 'Mustard square tile', color: '#d9a441', accent: '#b98a33', pattern: 'zellige', cost: 110, labor: 2, tone: 'warm', styles: ['midcentury'] },

  // Windows (cost per window)
  { id: 'win-classic', category: 'window', name: 'Double-hung', color: '#ffffff', cost: 450, labor: 1, tone: 'neutral', styles: ['classic', 'farmhouse'] },
  { id: 'win-picture', category: 'window', name: 'Big picture window', color: '#2d2d2d', cost: 900, labor: 2, tone: 'neutral', styles: ['modern', 'midcentury'] },
  { id: 'win-shutter', category: 'window', name: 'Shuttered cottage', color: '#6f9bb6', cost: 600, labor: 1, tone: 'cool', styles: ['coastal', 'farmhouse'] },
  { id: 'win-french', category: 'window', name: 'French door', color: '#f4f1ea', cost: 1400, labor: 2, tone: 'neutral', styles: ['classic', 'coastal'] },
  { id: 'win-old-alum', category: 'window', name: 'Drafty aluminum', color: '#9da3a6', cost: 0, labor: 0, tone: 'cool', styles: [], old: true },

  // Lighting mood (whole room)
  { id: 'light-warm', category: 'lighting', name: 'Warm and golden', color: '#ffcf8a', cost: 0, labor: 0, tone: 'warm', styles: ['farmhouse', 'classic', 'midcentury'] },
  { id: 'light-daylight', category: 'lighting', name: 'Bright daylight', color: '#ffffff', cost: 0, labor: 0, tone: 'neutral', styles: ['modern', 'coastal'] },
  { id: 'light-dusk', category: 'lighting', name: 'Cozy dusk', color: '#ff9f6b', cost: 0, labor: 0, tone: 'warm', styles: ['classic'] },
  { id: 'light-old-flicker', category: 'lighting', name: 'Flickering tube light', color: '#d9e6c8', cost: 0, labor: 0, tone: 'cool', styles: [], old: true },
];

export const finishById = (id: string): Finish => {
  const f = FINISHES.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown finish ${id}`);
  return f;
};

export type ItemKind =
  | 'cabinet'
  | 'appliance'
  | 'seating'
  | 'table'
  | 'plant'
  | 'lamp'
  | 'decor'
  | 'upgrade'
  | 'junk';

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  w: number;
  d: number;
  // Height in world units (one floor tile is 1 x 1, the wall is 3 tall).
  h: number;
  top: string;
  side: string;
  // Painted with the chosen cabinet finish and topped with the counter finish.
  usesCabinet?: boolean;
  usesCounter?: boolean;
  cost: number;
  labor: number;
  // Counts toward the kitchen essentials.
  essential?: 'fridge' | 'stove' | 'sink';
  blurb?: string;
}

export const ITEMS: ItemDef[] = [
  { id: 'base-cabinet', name: 'Base cabinet', kind: 'cabinet', w: 1, d: 1, h: 0.95, top: '#ddd', side: '#ccc', usesCabinet: true, usesCounter: true, cost: 0, labor: 0.5 },
  { id: 'sink-cabinet', name: 'Sink cabinet', kind: 'cabinet', w: 1, d: 1, h: 0.95, top: '#ddd', side: '#ccc', usesCabinet: true, usesCounter: true, cost: 320, labor: 1, essential: 'sink' },
  { id: 'tall-pantry', name: 'Tall pantry', kind: 'cabinet', w: 1, d: 1, h: 2.4, top: '#ddd', side: '#ccc', usesCabinet: true, cost: 200, labor: 0.5 },
  { id: 'fridge', name: 'Fridge', kind: 'appliance', w: 1, d: 1, h: 2.1, top: '#e9ecef', side: '#cfd5da', cost: 1400, labor: 0.5, essential: 'fridge' },
  { id: 'fridge-retro', name: 'Retro fridge (mint)', kind: 'appliance', w: 1, d: 1, h: 1.9, top: '#bfe3d4', side: '#9ccab7', cost: 1900, labor: 0.5, essential: 'fridge' },
  { id: 'stove', name: 'Gas range', kind: 'appliance', w: 1, d: 1, h: 0.95, top: '#3a3d42', side: '#c9ced3', cost: 1100, labor: 0.5, essential: 'stove' },
  { id: 'stove-pro', name: 'Pro six-burner range', kind: 'appliance', w: 2, d: 1, h: 0.95, top: '#2c2e33', side: '#b8bec4', cost: 4200, labor: 1, essential: 'stove' },
  { id: 'dishwasher', name: 'Dishwasher', kind: 'appliance', w: 1, d: 1, h: 0.95, top: '#d5d9dd', side: '#bcc2c8', usesCounter: true, cost: 700, labor: 0.5 },
  { id: 'table', name: 'Dining table', kind: 'table', w: 2, d: 1, h: 0.75, top: '#a7774c', side: '#8a603b', cost: 450, labor: 0 },
  { id: 'table-round', name: 'Round bistro table', kind: 'table', w: 1, d: 1, h: 0.75, top: '#f2ece2', side: '#d8cfc0', cost: 260, labor: 0 },
  { id: 'chair', name: 'Wood chair', kind: 'seating', w: 1, d: 1, h: 0.5, top: '#b5835a', side: '#946a47', cost: 90, labor: 0 },
  { id: 'stool', name: 'Counter stool', kind: 'seating', w: 1, d: 1, h: 0.65, top: '#2f3135', side: '#45484e', cost: 120, labor: 0 },
  { id: 'plant', name: 'Potted fig', kind: 'plant', w: 1, d: 1, h: 1.4, top: '#5f8f52', side: '#b86b47', cost: 70, labor: 0 },
  { id: 'herbs', name: 'Herb planter', kind: 'plant', w: 1, d: 1, h: 0.6, top: '#79a860', side: '#8f6e52', cost: 40, labor: 0 },
  { id: 'lamp', name: 'Floor lamp', kind: 'lamp', w: 1, d: 1, h: 1.7, top: '#ffe3a8', side: '#4a4a4a', cost: 150, labor: 0 },
  { id: 'rug', name: 'Woven rug', kind: 'decor', w: 2, d: 2, h: 0.04, top: '#c98f6b', side: '#a9765a', cost: 220, labor: 0 },
  { id: 'bench', name: 'Breakfast bench', kind: 'seating', w: 2, d: 1, h: 0.5, top: '#8f6a4a', side: '#73543a', cost: 380, labor: 0.5 },
  { id: 'cart', name: 'Rolling kitchen cart', kind: 'decor', w: 1, d: 1, h: 0.9, top: '#d9a441', side: '#6b6b6b', cost: 160, labor: 0 },
  // Big upgrades: expensive, slow, and they define the room.
  { id: 'island', name: "Chef's island", kind: 'upgrade', w: 2, d: 1, h: 0.95, top: '#ddd', side: '#ccc', usesCabinet: true, usesCounter: true, cost: 3800, labor: 3, blurb: 'Seats two, eats most of a kitchen budget.' },
  { id: 'coffee-bar', name: 'Built-in coffee bar', kind: 'upgrade', w: 2, d: 1, h: 2.2, top: '#6b4a33', side: '#5a3d29', cost: 2600, labor: 2, blurb: 'Espresso machine, open shelves, mug hooks.' },
  { id: 'wine-fridge', name: 'Wine fridge', kind: 'upgrade', w: 1, d: 1, h: 0.95, top: '#2b2b2f', side: '#3a2a35', usesCounter: true, cost: 1600, labor: 1, blurb: 'Needs its own circuit.' },
  { id: 'fireplace', name: 'Wood stove', kind: 'upgrade', w: 1, d: 1, h: 1.6, top: '#2e2e30', side: '#3d3d40', cost: 3200, labor: 3, blurb: 'A huge cozy boost. Needs a chimney.' },
];

export const JUNK: ItemDef[] = [
  { id: 'junk-boxes', name: 'Stack of boxes', kind: 'junk', w: 1, d: 1, h: 0.9, top: '#c9a26b', side: '#a8834f', cost: 0, labor: 0 },
  { id: 'junk-armchair', name: 'Moth-eaten armchair', kind: 'junk', w: 1, d: 1, h: 0.9, top: '#8c5e5a', side: '#6e4744', cost: 0, labor: 0 },
  { id: 'junk-bags', name: 'Trash bags', kind: 'junk', w: 1, d: 1, h: 0.6, top: '#2f3135', side: '#24262a', cost: 0, labor: 0 },
  { id: 'junk-tv', name: 'Old tube TV', kind: 'junk', w: 1, d: 1, h: 0.8, top: '#4d4a46', side: '#3a3835', cost: 0, labor: 0 },
  { id: 'junk-paint', name: 'Dried-out paint cans', kind: 'junk', w: 1, d: 1, h: 0.4, top: '#b8c4cc', side: '#8f9ba3', cost: 0, labor: 0 },
];

export const itemById = (id: string): ItemDef => {
  const it = ITEMS.find((x) => x.id === id) ?? JUNK.find((x) => x.id === id);
  if (!it) throw new Error(`Unknown item ${id}`);
  return it;
};

// When during the renovation an issue can surface.
export type IssueTrigger = 'start' | 'floor' | 'walls' | 'build';

export interface IssueOption {
  label: string;
  cost: number;
  days: number;
  // A patch is cheap now but can come back during the build, with this chance.
  patch?: boolean;
  risk?: number;
}

export interface IssueDef {
  id: string;
  name: string;
  trigger: IssueTrigger;
  found: string;
  hint?: string;
  options: IssueOption[];
}

export const ISSUES: IssueDef[] = [
  {
    id: 'leaky-sink',
    name: 'Leaky sink',
    trigger: 'start',
    found: 'The old sink drips constantly.',
    options: [{ label: 'Replace the supply lines', cost: 150, days: 1 }],
  },
  {
    id: 'flicker',
    name: 'Flickering light',
    trigger: 'start',
    found: 'The ceiling light buzzes and flickers.',
    options: [{ label: 'Swap the fixture and switch', cost: 250, days: 1 }],
  },
  {
    id: 'dry-rot',
    name: 'Dry rot',
    trigger: 'floor',
    found: 'Pulling up the floor reveals soft, crumbling subfloor near the sink.',
    hint: 'The floor feels spongy near the sink.',
    options: [
      { label: 'Replace the subfloor properly', cost: 1800, days: 3 },
      { label: 'Patch the worst spots', cost: 600, days: 1, patch: true, risk: 0.5 },
    ],
  },
  {
    id: 'termites',
    name: 'Termites',
    trigger: 'floor',
    found: 'Tiny tunnels in the joists. Termites have been snacking.',
    hint: 'Little piles of sawdust by the back door.',
    options: [
      { label: 'Treat and replace damaged joists', cost: 1500, days: 2 },
      { label: 'Spot treat only', cost: 300, days: 1, patch: true, risk: 0.6 },
    ],
  },
  {
    id: 'water-damage',
    name: 'Water damage',
    trigger: 'walls',
    found: 'Behind the wallpaper the drywall is stained and soft. An old pipe leak.',
    hint: 'A brown stain creeps across one wall.',
    options: [
      { label: 'Fix the pipe and replace drywall', cost: 1300, days: 2 },
      { label: 'Dry it out and paint over', cost: 250, days: 1, patch: true, risk: 0.45 },
    ],
  },
  {
    id: 'old-wiring',
    name: 'Old wiring',
    trigger: 'walls',
    found: 'Cloth-wrapped wiring from the 1950s, and not much of it.',
    hint: 'Outlets are warm to the touch.',
    options: [
      { label: 'Rewire the kitchen', cost: 2200, days: 3 },
      { label: 'Replace just the bad outlets', cost: 400, days: 1, patch: true, risk: 0.35 },
    ],
  },
  {
    id: 'mold',
    name: 'Mold',
    trigger: 'walls',
    found: 'A patch of black mold behind where the fridge used to be.',
    hint: 'A musty smell near the corner.',
    options: [
      { label: 'Remediate and add ventilation', cost: 1200, days: 2 },
      { label: 'Bleach it and hope', cost: 150, days: 1, patch: true, risk: 0.65 },
    ],
  },
  {
    id: 'ceiling-leak',
    name: 'Leak from upstairs',
    trigger: 'build',
    found: 'Opening the ceiling for new lights, the crew finds the upstairs bathroom has been leaking.',
    hint: 'A faint water ring on the ceiling.',
    options: [
      { label: 'Fix the bathroom drain and ceiling', cost: 1600, days: 2 },
      { label: 'Patch the ceiling for now', cost: 400, days: 1, patch: true, risk: 0.4 },
    ],
  },
  {
    id: 'out-of-square',
    name: 'Crooked walls',
    trigger: 'build',
    found: 'Installing cabinets, the crew discovers no wall in this house is straight.',
    options: [
      { label: 'Shim and scribe everything', cost: 900, days: 2 },
      { label: 'Caulk the gaps', cost: 120, days: 0, patch: true, risk: 0.25 },
    ],
  },
];

export const issueById = (id: string): IssueDef => {
  const i = ISSUES.find((x) => x.id === id);
  if (!i) throw new Error(`Unknown issue ${id}`);
  return i;
};

export interface Scenario {
  id: string;
  name: string;
  blurb: string;
  budget: number;
  targetDay: number;
  style?: Style;
  styleLabel?: string;
  start: { floor: string; wall: string; cabinet: string; counter: string; window: string; lighting: string };
  // Hidden issues and the chance each one is in this particular house.
  issuePool: { id: string; chance: number }[];
  junk: { id: string; x: number; y: number }[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'grandma',
    name: "Grandma's house",
    blurb: 'Solid bones and floral everything. Keep the charm or go fully modern.',
    budget: 26000,
    targetDay: 28,
    start: { floor: 'floor-old-lino', wall: 'wall-old-floral', cabinet: 'cab-old-laminate', counter: 'ctr-old-formica', window: 'win-old-alum', lighting: 'light-old-flicker' },
    issuePool: [
      { id: 'water-damage', chance: 0.7 },
      { id: 'old-wiring', chance: 0.8 },
      { id: 'ceiling-leak', chance: 0.5 },
      { id: 'out-of-square', chance: 0.5 },
    ],
    junk: [
      { id: 'junk-boxes', x: 4, y: 3 },
      { id: 'junk-armchair', x: 5, y: 4 },
      { id: 'junk-boxes', x: 2, y: 4 },
      { id: 'junk-tv', x: 6, y: 2 },
    ],
  },
  {
    id: 'fixer',
    name: 'Neglected fixer',
    blurb: 'Cheap to buy, and it shows. Expect surprises and spend wisely.',
    budget: 22000,
    targetDay: 32,
    start: { floor: 'floor-old-carpet', wall: 'wall-old-grime', cabinet: 'cab-old-laminate', counter: 'ctr-old-formica', window: 'win-old-alum', lighting: 'light-old-flicker' },
    issuePool: [
      { id: 'dry-rot', chance: 0.9 },
      { id: 'termites', chance: 0.6 },
      { id: 'mold', chance: 0.7 },
      { id: 'ceiling-leak', chance: 0.6 },
      { id: 'out-of-square', chance: 0.4 },
    ],
    junk: [
      { id: 'junk-bags', x: 3, y: 2 },
      { id: 'junk-bags', x: 5, y: 3 },
      { id: 'junk-tv', x: 2, y: 4 },
      { id: 'junk-paint', x: 6, y: 4 },
      { id: 'junk-boxes', x: 4, y: 4 },
    ],
  },
  {
    id: 'midcentury',
    name: 'Mid-century gem',
    blurb: 'A great 1958 layout under tired finishes. Restore the period look.',
    budget: 28000,
    targetDay: 26,
    style: 'midcentury',
    styleLabel: 'Mid-century',
    start: { floor: 'floor-old-lino', wall: 'wall-old-grime', cabinet: 'cab-old-laminate', counter: 'ctr-old-formica', window: 'win-old-alum', lighting: 'light-old-flicker' },
    issuePool: [
      { id: 'old-wiring', chance: 0.9 },
      { id: 'out-of-square', chance: 0.3 },
      { id: 'ceiling-leak', chance: 0.3 },
    ],
    junk: [
      { id: 'junk-boxes', x: 4, y: 3 },
      { id: 'junk-tv', x: 5, y: 2 },
      { id: 'junk-paint', x: 3, y: 4 },
    ],
  },
  {
    id: 'coastal',
    name: 'Style challenge: coastal',
    blurb: 'A beach cottage client wants breezy, light, and blue. Design to the brief.',
    budget: 24000,
    targetDay: 28,
    style: 'coastal',
    styleLabel: 'Coastal',
    start: { floor: 'floor-old-carpet', wall: 'wall-old-floral', cabinet: 'cab-old-laminate', counter: 'ctr-old-formica', window: 'win-old-alum', lighting: 'light-old-flicker' },
    issuePool: [
      { id: 'mold', chance: 0.7 },
      { id: 'water-damage', chance: 0.5 },
      { id: 'ceiling-leak', chance: 0.4 },
    ],
    junk: [
      { id: 'junk-boxes', x: 3, y: 3 },
      { id: 'junk-bags', x: 5, y: 4 },
      { id: 'junk-armchair', x: 6, y: 2 },
    ],
  },
];

export const scenarioById = (id: string): Scenario => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return s;
};

// Room size in floor tiles. Walls run along the back (y = 0) and left (x = 0).
export const ROOM_W = 8;
export const ROOM_D = 6;

// Quarter turns. Odd turns swap width and depth; the front faces +y, +x, -y, -x.
export type Rot = 0 | 1 | 2 | 3;

export const INSPECTION_COST = 400;
export const DEMO_COST = 300;
// What a crew day costs on top of materials.
export const LABOR_RATE = 250;

// The tired kitchen you start with, before demolition.
export const OLD_LAYOUT: { id: string; x: number; y: number; rot: Rot }[] = [
  { id: 'base-cabinet', x: 0, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 1, y: 0, rot: 0 },
  { id: 'sink-cabinet', x: 2, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 3, y: 0, rot: 0 },
  { id: 'stove', x: 4, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 0, y: 1, rot: 1 },
  { id: 'fridge', x: 0, y: 2, rot: 1 },
];

// Appliances with doors that need room to open, so they can't sit in a corner between counters.
export const DOOR_ITEMS = new Set(['fridge', 'fridge-retro', 'stove', 'stove-pro', 'dishwasher', 'wine-fridge']);

// A ready-made L-shaped kitchen for players who want a head start.
export const STARTER_LAYOUT: { id: string; x: number; y: number; rot: Rot }[] = [
  { id: 'tall-pantry', x: 0, y: 0, rot: 0 },
  { id: 'fridge', x: 1, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 2, y: 0, rot: 0 },
  { id: 'sink-cabinet', x: 3, y: 0, rot: 0 },
  { id: 'dishwasher', x: 4, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 5, y: 0, rot: 0 },
  { id: 'base-cabinet', x: 0, y: 1, rot: 1 },
  { id: 'stove', x: 0, y: 2, rot: 1 },
  { id: 'base-cabinet', x: 0, y: 3, rot: 1 },
];

export const OLD_WINDOWS: { wall: 'back' | 'left'; slot: number }[] = [
  { wall: 'back', slot: 3 },
  { wall: 'left', slot: 4 },
];
