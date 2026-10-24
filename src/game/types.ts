import type { SkillId, WeaponId } from './data'

export type GameStatus = 'playing' | 'paused' | 'dead' | 'victory'

export interface SkillHud {
  id: SkillId
  name: string
  key: string
  /** 0..1, 1 = ready */
  ready: number
  active: boolean
  charges?: number
  maxCharges?: number
}

export interface KillFeedEntry {
  id: number
  text: string
  headshot: boolean
}

export interface HudState {
  status: GameStatus
  health: number
  maxHealth: number
  weaponName: string
  weaponId: WeaponId
  slot: number
  slots: { id: WeaponId; name: string }[]
  mag: number
  reserve: number
  melee: boolean
  reloading: boolean
  reloadProgress: number
  ads: number
  scoped: boolean
  spread: number
  skills: SkillHud[]
  wave: number
  totalWaves: number
  enemiesLeft: number
  waveBanner: string | null
  kills: number
  headshots: number
  shotsFired: number
  shotsHit: number
  score: number
  time: number
  hitMarker: number
  headshotMarker: number
  damageFlash: number
  damageAngles: number[]
  pickupPrompt: string | null
  killFeed: KillFeedEntry[]
  invisible: boolean
  armored: boolean
  focused: boolean
  grappling: boolean
  pulsing: boolean
  pointerLocked: boolean
}
