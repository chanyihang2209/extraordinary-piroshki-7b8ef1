// Static game content: weapons, player classes, enemy classes, difficulties and arenas.
// Everything tunable about the game lives here so balance changes don't touch the engine.

export type WeaponId =
  | 'pistol'
  | 'revolver'
  | 'smg'
  | 'rifle'
  | 'shotgun'
  | 'dmr'
  | 'sniper'
  | 'lmg'
  | 'katana'

export interface WeaponDef {
  id: WeaponId
  name: string
  kind: string
  damage: number
  /** shots per second */
  fireRate: number
  magSize: number
  reserve: number
  reloadTime: number
  /** hip-fire cone (radians) */
  spread: number
  /** aim-down-sights cone (radians) */
  adsSpread: number
  /** FOV divisor while aiming down sights */
  zoom: number
  pellets: number
  range: number
  auto: boolean
  recoil: number
  melee?: boolean
  /** shows a full-screen scope overlay while aiming */
  scope?: boolean
  color: number
  /** relative loudness for alerting enemies (0 = silent) */
  noise: number
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: 'pistol', name: 'M9 Viper', kind: 'Pistol', damage: 30, fireRate: 5, magSize: 12, reserve: 72,
    reloadTime: 1.2, spread: 0.02, adsSpread: 0.006, zoom: 1.15, pellets: 1, range: 60, auto: false,
    recoil: 0.5, color: 0x2b2f36, noise: 14,
  },
  revolver: {
    id: 'revolver', name: 'Judge .44', kind: 'Revolver', damage: 62, fireRate: 2, magSize: 6, reserve: 36,
    reloadTime: 2.0, spread: 0.025, adsSpread: 0.004, zoom: 1.25, pellets: 1, range: 70, auto: false,
    recoil: 1.2, color: 0x5a5148, noise: 18,
  },
  smg: {
    id: 'smg', name: 'Vector-K', kind: 'SMG', damage: 17, fireRate: 13, magSize: 32, reserve: 192,
    reloadTime: 1.6, spread: 0.045, adsSpread: 0.018, zoom: 1.25, pellets: 1, range: 45, auto: true,
    recoil: 0.35, color: 0x30343b, noise: 14,
  },
  rifle: {
    id: 'rifle', name: 'AR-7 Talon', kind: 'Assault Rifle', damage: 26, fireRate: 9, magSize: 30, reserve: 150,
    reloadTime: 2.0, spread: 0.035, adsSpread: 0.007, zoom: 1.5, pellets: 1, range: 90, auto: true,
    recoil: 0.5, color: 0x3d4434, noise: 18,
  },
  shotgun: {
    id: 'shotgun', name: 'Breacher 12', kind: 'Shotgun', damage: 15, fireRate: 1.4, magSize: 6, reserve: 36,
    reloadTime: 2.4, spread: 0.09, adsSpread: 0.06, zoom: 1.15, pellets: 9, range: 28, auto: false,
    recoil: 1.6, color: 0x4a3a2c, noise: 22,
  },
  dmr: {
    id: 'dmr', name: 'Sentinel DMR', kind: 'Marksman Rifle', damage: 58, fireRate: 3.5, magSize: 10, reserve: 60,
    reloadTime: 2.2, spread: 0.03, adsSpread: 0.003, zoom: 2.5, pellets: 1, range: 120, auto: false,
    recoil: 0.9, color: 0x3a3f47, noise: 20,
  },
  sniper: {
    id: 'sniper', name: 'Longbow .50', kind: 'Sniper Rifle', damage: 125, fireRate: 0.9, magSize: 5, reserve: 25,
    reloadTime: 2.8, spread: 0.07, adsSpread: 0.0, zoom: 4.5, pellets: 1, range: 200, auto: false,
    recoil: 2.2, scope: true, color: 0x26292e, noise: 26,
  },
  lmg: {
    id: 'lmg', name: 'Bulldozer M60', kind: 'Light Machine Gun', damage: 29, fireRate: 10, magSize: 80, reserve: 160,
    reloadTime: 3.6, spread: 0.05, adsSpread: 0.018, zoom: 1.35, pellets: 1, range: 80, auto: true,
    recoil: 0.6, color: 0x2f3328, noise: 22,
  },
  katana: {
    id: 'katana', name: 'Kage Blade', kind: 'Melee', damage: 95, fireRate: 2.2, magSize: 0, reserve: 0,
    reloadTime: 0, spread: 0, adsSpread: 0, zoom: 1.1, pellets: 1, range: 3.2, auto: true,
    recoil: 0, melee: true, color: 0xc9ced6, noise: 0,
  },
}

export type SkillId =
  | 'grapple'
  | 'invisibility'
  | 'stars'
  | 'frag'
  | 'adrenaline'
  | 'rocket'
  | 'armor'
  | 'pulse'
  | 'focus'

export interface SkillDef {
  id: SkillId
  name: string
  key: 'Q' | 'F' | 'G'
  cooldown: number
  duration?: number
  charges?: number
  description: string
}

export const SKILLS: Record<SkillId, SkillDef> = {
  grapple: { id: 'grapple', name: 'Grappling Hook', key: 'Q', cooldown: 3.5, description: 'Fire a hook at any surface and get yanked toward it.' },
  invisibility: { id: 'invisibility', name: 'Shadow Veil', key: 'F', cooldown: 18, duration: 6, description: 'Turn invisible for 6s. Enemies lose track of you.' },
  stars: { id: 'stars', name: 'Shuriken', key: 'G', cooldown: 3, charges: 3, description: 'Silent throwing stars with heavy bonus damage.' },
  frag: { id: 'frag', name: 'Frag Grenade', key: 'Q', cooldown: 8, description: 'Cooked frag that bounces and blasts after 1.8s.' },
  adrenaline: { id: 'adrenaline', name: 'Adrenaline', key: 'F', cooldown: 20, duration: 5, description: 'Heal 40 HP and move 40% faster for 5s.' },
  rocket: { id: 'rocket', name: 'Rocket', key: 'Q', cooldown: 10, description: 'Shoulder rocket that explodes on impact.' },
  armor: { id: 'armor', name: 'Iron Wall', key: 'F', cooldown: 22, duration: 6, description: 'Take 65% less damage for 6s.' },
  pulse: { id: 'pulse', name: 'Recon Pulse', key: 'Q', cooldown: 14, duration: 7, description: 'Reveal every enemy through walls for 7s.' },
  focus: { id: 'focus', name: 'Deadeye Focus', key: 'F', cooldown: 20, duration: 4, description: 'Slow the world to 35% speed for 4s.' },
}

export type ClassId = 'ninja' | 'assault' | 'heavy' | 'recon'

export interface PlayerClassDef {
  id: ClassId
  name: string
  tagline: string
  health: number
  speed: number
  weapons: WeaponId[]
  skills: SkillId[]
  accent: string
}

export const PLAYER_CLASSES: PlayerClassDef[] = [
  {
    id: 'ninja', name: 'Ninja', tagline: 'Fast, fragile, unseen.', health: 80, speed: 1.22,
    weapons: ['katana', 'smg', 'dmr'], skills: ['grapple', 'invisibility', 'stars'], accent: '#a78bfa',
  },
  {
    id: 'assault', name: 'Assault', tagline: 'The all-rounder on point.', health: 100, speed: 1.0,
    weapons: ['rifle', 'smg', 'shotgun'], skills: ['frag', 'adrenaline'], accent: '#f97316',
  },
  {
    id: 'heavy', name: 'Heavy', tagline: 'Walks through gunfire.', health: 160, speed: 0.86,
    weapons: ['lmg', 'shotgun', 'rifle'], skills: ['rocket', 'armor'], accent: '#ef4444',
  },
  {
    id: 'recon', name: 'Recon', tagline: 'Sees first, shoots first.', health: 90, speed: 1.05,
    weapons: ['sniper', 'dmr', 'rifle'], skills: ['pulse', 'focus'], accent: '#22d3ee',
  },
]

export type EnemyClassId = 'rifleman' | 'breacher' | 'marksman' | 'gunner' | 'officer' | 'striker'

export interface EnemyClassDef {
  id: EnemyClassId
  name: string
  weapon: WeaponId
  health: number
  speed: number
  scale: number
  color: number
  /** base hit chance per shot at close range */
  accuracy: number
  damage: number
  /** seconds between shots inside a burst */
  shotInterval: number
  burst: number
  burstPause: number
  /** distance the enemy tries to keep from the player */
  preferredRange: number
  viewRange: number
}

export const ENEMY_CLASSES: Record<EnemyClassId, EnemyClassDef> = {
  rifleman: { id: 'rifleman', name: 'Rifleman', weapon: 'rifle', health: 100, speed: 3.3, scale: 1, color: 0x5b6b3a, accuracy: 0.42, damage: 7, shotInterval: 0.14, burst: 4, burstPause: 1.1, preferredRange: 16, viewRange: 40 },
  breacher: { id: 'breacher', name: 'Breacher', weapon: 'shotgun', health: 95, speed: 5.0, scale: 1, color: 0x9b2c2c, accuracy: 0.7, damage: 22, shotInterval: 0.8, burst: 1, burstPause: 0.6, preferredRange: 4, viewRange: 30 },
  marksman: { id: 'marksman', name: 'Marksman', weapon: 'sniper', health: 70, speed: 2.7, scale: 0.97, color: 0x3d5a73, accuracy: 0.8, damage: 34, shotInterval: 0.1, burst: 1, burstPause: 3.2, preferredRange: 32, viewRange: 65 },
  gunner: { id: 'gunner', name: 'Gunner', weapon: 'lmg', health: 220, speed: 2.2, scale: 1.2, color: 0x4a4a4a, accuracy: 0.33, damage: 6, shotInterval: 0.1, burst: 10, burstPause: 1.6, preferredRange: 14, viewRange: 40 },
  officer: { id: 'officer', name: 'Officer', weapon: 'revolver', health: 120, speed: 3.6, scale: 1.02, color: 0x1f2937, accuracy: 0.55, damage: 15, shotInterval: 0.55, burst: 3, burstPause: 1.3, preferredRange: 11, viewRange: 42 },
  striker: { id: 'striker', name: 'Striker', weapon: 'smg', health: 85, speed: 4.4, scale: 0.95, color: 0x7c3aed, accuracy: 0.36, damage: 5, shotInterval: 0.08, burst: 8, burstPause: 1.0, preferredRange: 8, viewRange: 34 },
}

export type DifficultyId = 'recruit' | 'veteran' | 'elite' | 'nightmare'

export interface DifficultyDef {
  id: DifficultyId
  name: string
  description: string
  enemyHealth: number
  enemyDamage: number
  accuracy: number
  /** seconds an enemy needs after spotting you before it fires */
  reaction: number
  countMult: number
  regen: boolean
  scoreMult: number
}

export const DIFFICULTIES: DifficultyDef[] = [
  { id: 'recruit', name: 'Recruit', description: 'Slow reactions, forgiving damage.', enemyHealth: 0.8, enemyDamage: 0.5, accuracy: 0.6, reaction: 1.0, countMult: 0.75, regen: true, scoreMult: 0.75 },
  { id: 'veteran', name: 'Veteran', description: 'A fair fight.', enemyHealth: 1, enemyDamage: 0.85, accuracy: 0.85, reaction: 0.6, countMult: 1, regen: true, scoreMult: 1 },
  { id: 'elite', name: 'Elite', description: 'Sharp aim, more enemies.', enemyHealth: 1.2, enemyDamage: 1.15, accuracy: 1.0, reaction: 0.38, countMult: 1.25, regen: true, scoreMult: 1.5 },
  { id: 'nightmare', name: 'Nightmare', description: 'No health regen. No mercy.', enemyHealth: 1.45, enemyDamage: 1.5, accuracy: 1.15, reaction: 0.22, countMult: 1.5, regen: false, scoreMult: 2.2 },
]

export type ArenaId = 'warehouse' | 'outpost' | 'neon' | 'bunker'

export interface ArenaDef {
  id: ArenaId
  name: string
  description: string
  /**
   * Grid map, one character per cell:
   * `#` wall, `C` tall crate, `c` low crate (jumpable cover), `o` pillar,
   * `P` player spawn, `E` enemy spawn, `H` health pack, `.` floor.
   */
  map: string[]
  wallHeight: number
  sky: number
  fog: number
  fogNear: number
  fogFar: number
  floor: number
  floorLine: number
  wall: number
  crate: number
  pillar: number
  ambient: number
  ambientIntensity: number
  sun: number
  sunIntensity: number
  /** neon accent lights placed around the map */
  accents?: number[]
  waves: EnemyClassId[][]
  preview: string
}

export const ARENAS: ArenaDef[] = [
  {
    id: 'warehouse',
    name: 'Dockside Warehouse',
    description: 'Tight aisles of stacked freight. Close-quarters chaos.',
    preview: 'linear-gradient(135deg,#3b3a36,#6b5b45)',
    wallHeight: 6,
    sky: 0x1b1d22, fog: 0x1b1d22, fogNear: 20, fogFar: 85,
    floor: 0x4a4744, floorLine: 0x5d5955, wall: 0x6e6a62, crate: 0x8a6a3e, pillar: 0x55524d,
    ambient: 0xfff1d6, ambientIntensity: 0.55, sun: 0xffe2b0, sunIntensity: 1.1,
    map: [
      '########################',
      '#E....c.....E.....c...E#',
      '#.CC.....CC....CC......#',
      '#.CC..c..CC....CC..cc..#',
      '#.........o.........o..#',
      '#..c...CCCC...CCCC.....#',
      '#E.....CCCC...CCCC....E#',
      '#...H..........c.......#',
      '#.cc.......o.......cc..#',
      '#......CC.....CC.......#',
      '#..o...CC..c..CC...o...#',
      '#.........P.........H..#',
      '#.cc......c.......cc...#',
      '#......CCCC...CCCC.....#',
      '#E.....CCCC...CCCC....E#',
      '#..c...........c.......#',
      '#.CC..o....cc....o..CC.#',
      '#.CC................CC.#',
      '#E.....c....E....c....E#',
      '########################',
    ],
    waves: [
      ['rifleman', 'rifleman', 'breacher', 'rifleman'],
      ['rifleman', 'breacher', 'striker', 'officer', 'rifleman', 'striker'],
      ['gunner', 'breacher', 'striker', 'officer', 'rifleman', 'breacher', 'marksman', 'striker'],
    ],
  },
  {
    id: 'outpost',
    name: 'Desert Outpost',
    description: 'Sun-bleached compound with long sightlines. Snipers welcome.',
    preview: 'linear-gradient(135deg,#d6a35c,#8c5a2b)',
    wallHeight: 5,
    sky: 0xe9c79a, fog: 0xe6c08e, fogNear: 40, fogFar: 160,
    floor: 0xc9a46c, floorLine: 0xbf9960, wall: 0xb88a5a, crate: 0x7d6a4f, pillar: 0xa77a4c,
    ambient: 0xffe9c8, ambientIntensity: 0.7, sun: 0xfff2d8, sunIntensity: 1.6,
    map: [
      '############################',
      '#E..........E.............E#',
      '#..........................#',
      '#...###.......c.......###..#',
      '#...#.........c.........#..#',
      '#...#....cc.......cc....#..#',
      '#.........................H#',
      '#E....o.....#####.....o...E#',
      '#...........#...#..........#',
      '#.....c.....#.E.#.....c....#',
      '#...........#...#..........#',
      '#...........##.##..........#',
      '#..cc..................cc..#',
      '#..........................#',
      '#....###......P.....###....#',
      '#....#..............#......#',
      '#H...#....c....c....#.....E#',
      '#..........................#',
      '#E.....o..........o.......E#',
      '#..........................#',
      '#E...........E............E#',
      '############################',
    ],
    waves: [
      ['rifleman', 'marksman', 'rifleman', 'officer'],
      ['marksman', 'rifleman', 'breacher', 'marksman', 'rifleman', 'striker'],
      ['marksman', 'gunner', 'marksman', 'officer', 'rifleman', 'breacher', 'rifleman', 'gunner'],
    ],
  },
  {
    id: 'neon',
    name: 'Neon District',
    description: 'Rain-slick alleys under buzzing signs. Every corner is an ambush.',
    preview: 'linear-gradient(135deg,#1e1b4b,#be185d)',
    wallHeight: 9,
    sky: 0x07060f, fog: 0x120a24, fogNear: 12, fogFar: 70,
    floor: 0x1a1a24, floorLine: 0x2a2840, wall: 0x2a2738, crate: 0x3b3355, pillar: 0x24203a,
    ambient: 0x8a7dff, ambientIntensity: 0.35, sun: 0xb6a6ff, sunIntensity: 0.35,
    accents: [0xff2bd6, 0x22e5ff, 0xffb020, 0x7cff4f],
    map: [
      '##########################',
      '#E...#.......E......#...E#',
      '#....#..............#....#',
      '#..c.#..####..####..#.c..#',
      '#....................H...#',
      '###..###..#....#..###..###',
      '#E.......c#....#c.......E#',
      '#.........#.oo.#.........#',
      '#..####..........####....#',
      '#..#......c..c......#....#',
      '#..#.......P........#....#',
      '#........####..####......#',
      '#E..c................c..E#',
      '###..###..#....#..###..###',
      '#.........#....#.........#',
      '#..c...H..........cc.....#',
      '#....#..####..####..#....#',
      '#E...#.......E......#...E#',
      '##########################',
    ],
    waves: [
      ['striker', 'rifleman', 'striker', 'breacher'],
      ['striker', 'officer', 'breacher', 'striker', 'rifleman', 'marksman'],
      ['striker', 'striker', 'breacher', 'officer', 'gunner', 'marksman', 'breacher', 'officer'],
    ],
  },
  {
    id: 'bunker',
    name: 'Frozen Bunker',
    description: 'A snowed-in research site wrapped in whiteout fog.',
    preview: 'linear-gradient(135deg,#dbeafe,#64748b)',
    wallHeight: 5,
    sky: 0xcfd8e3, fog: 0xd5dde8, fogNear: 10, fogFar: 60,
    floor: 0xe8eef4, floorLine: 0xd3dce6, wall: 0x7b8794, crate: 0x4b5563, pillar: 0x94a3b8,
    ambient: 0xdbe7ff, ambientIntensity: 0.75, sun: 0xffffff, sunIntensity: 0.9,
    map: [
      '########################',
      '#E.........##.........E#',
      '#..cc......##......cc..#',
      '#......o........o......#',
      '#..####....cc....####..#',
      '#..#..................H#',
      '#E.#...C........C.....E#',
      '#......C...oo...C......#',
      '#.c....................#',
      '##...####..P...####...##',
      '#.c....................#',
      '#......C...oo...C......#',
      '#E.....C........C...#.E#',
      '#H..................#..#',
      '#..####....cc....####..#',
      '#......o........o......#',
      '#..cc......##......cc..#',
      '#E.........##.........E#',
      '########################',
    ],
    waves: [
      ['rifleman', 'officer', 'rifleman', 'breacher'],
      ['gunner', 'rifleman', 'striker', 'marksman', 'officer', 'breacher'],
      ['gunner', 'gunner', 'marksman', 'striker', 'officer', 'breacher', 'rifleman', 'striker'],
    ],
  },
]

export interface GameConfig {
  classId: ClassId
  weaponId: WeaponId
  difficultyId: DifficultyId
  arenaId: ArenaId
}
