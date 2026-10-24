import { useState } from 'react'
import { Crosshair, Gauge, Map as MapIcon, Shield, Skull, Swords, Zap } from 'lucide-react'
import {
  ARENAS,
  DIFFICULTIES,
  PLAYER_CLASSES,
  SKILLS,
  WEAPONS,
  type ArenaId,
  type ClassId,
  type DifficultyId,
  type GameConfig,
  type WeaponDef,
  type WeaponId,
} from '@/game/data'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const HERO = '/.netlify/images?url=/img/hero.png&w=1600&fm=webp&q=75'

const CLASS_ICONS: Record<ClassId, typeof Swords> = {
  ninja: Swords,
  assault: Crosshair,
  heavy: Shield,
  recon: Zap,
}

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0 uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.round(Math.min(1, value) * 100)}%` }} />
      </div>
    </div>
  )
}

function weaponStats(w: WeaponDef) {
  return {
    damage: (w.damage * w.pellets) / 135,
    rate: w.fireRate / 13,
    range: Math.min(1, w.range / 140),
    zoom: (w.zoom - 1) / 3.5,
  }
}

function SectionTitle({ index, title, icon: Icon }: { index: string; title: string; icon: typeof Swords }) {
  return (
    <h2 className="mb-3 flex items-center gap-3 font-display text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
      <span className="text-primary">{index}</span>
      <Icon className="size-4" aria-hidden />
      {title}
    </h2>
  )
}

export function LoadoutScreen({ initial, onDeploy }: { initial?: GameConfig; onDeploy: (c: GameConfig) => void }) {
  const [classId, setClassId] = useState<ClassId>(initial?.classId ?? 'ninja')
  const pclass = PLAYER_CLASSES.find((c) => c.id === classId)!
  const [weaponId, setWeaponId] = useState<WeaponId>(initial?.weaponId ?? pclass.weapons[0])
  const [arenaId, setArenaId] = useState<ArenaId>(initial?.arenaId ?? 'warehouse')
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(initial?.difficultyId ?? 'veteran')

  const pickClass = (id: ClassId) => {
    setClassId(id)
    const c = PLAYER_CLASSES.find((x) => x.id === id)!
    if (!c.weapons.includes(weaponId)) setWeaponId(c.weapons[0])
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <img src={HERO} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover object-right opacity-60" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/60" />

      <div className="relative mx-auto max-w-content px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-10 max-w-2xl">
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.4em] text-primary">Arena FPS · Browser</p>
          <h1 className="font-display text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl">
            IRON<span className="text-primary">SIGHT</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Pick a class, choose your gun and drop into the arena. Enemies hunt you the moment they see you — or the moment you
            shoot them. Headshots kill instantly. Grab the weapons they drop.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-8">
            {/* class */}
            <section>
              <SectionTitle index="01" title="Class" icon={Skull} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PLAYER_CLASSES.map((c) => {
                  const Icon = CLASS_ICONS[c.id]
                  const active = c.id === classId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => pickClass(c.id)}
                      aria-pressed={active}
                      className={cn(
                        'group rounded-md border bg-card/70 p-4 text-left backdrop-blur transition-colors hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                        active && 'border-primary bg-card',
                      )}
                      style={active ? { boxShadow: `inset 0 -3px 0 ${c.accent}` } : undefined}
                    >
                      <Icon className="mb-3 size-6" style={{ color: c.accent }} aria-hidden />
                      <div className="font-display text-lg font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.tagline}</div>
                      <div className="mt-3 flex gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                        <span>HP {c.health}</span>
                        <span>SPD {Math.round(c.speed * 100)}%</span>
                      </div>
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {pclass.skills.map((id) => {
                  const s = SKILLS[id]
                  return (
                    <div key={id} className="rounded-md border bg-card/60 p-3 backdrop-blur">
                      <div className="flex items-center gap-2">
                        <kbd className="rounded border border-primary/50 bg-primary/10 px-1.5 font-display text-xs font-bold text-primary">{s.key}</kbd>
                        <span className="font-display text-sm font-semibold">{s.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* weapon */}
            <section>
              <SectionTitle index="02" title="Starting weapon" icon={Crosshair} />
              <div className="grid gap-3 sm:grid-cols-3">
                {pclass.weapons.map((id) => {
                  const w = WEAPONS[id]
                  const st = weaponStats(w)
                  const active = id === weaponId
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setWeaponId(id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border bg-card/70 p-4 text-left backdrop-blur transition-colors hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                        active && 'border-primary bg-card',
                      )}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{w.kind}</div>
                      <div className="mb-3 font-display text-base font-semibold">{w.name}</div>
                      <div className="space-y-1.5">
                        <StatBar label="Damage" value={st.damage} />
                        <StatBar label={w.melee ? 'Speed' : 'Rate'} value={st.rate} />
                        <StatBar label="Range" value={st.range} />
                        <StatBar label="Zoom" value={st.zoom} />
                      </div>
                      <div className="mt-3 text-[11px] uppercase tracking-wider text-muted-foreground">
                        {w.melee ? 'Silent · no ammo' : `${w.magSize} rds · ADS ×${w.zoom.toFixed(2).replace(/0$/, '')}`}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Every class also carries the {WEAPONS.pistol.name} sidearm.</p>
            </section>
          </div>

          <div className="space-y-8">
            {/* arena */}
            <section>
              <SectionTitle index="03" title="Arena" icon={MapIcon} />
              <div className="grid grid-cols-2 gap-3">
                {ARENAS.map((a) => {
                  const active = a.id === arenaId
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setArenaId(a.id)}
                      aria-pressed={active}
                      className={cn(
                        'overflow-hidden rounded-md border bg-card/70 text-left backdrop-blur transition-colors hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                        active && 'border-primary',
                      )}
                    >
                      <div className="h-14" style={{ background: a.preview }} />
                      <div className="p-3">
                        <div className="font-display text-sm font-semibold">{a.name}</div>
                        <div className="text-xs text-muted-foreground">{a.description}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* difficulty */}
            <section>
              <SectionTitle index="04" title="Difficulty" icon={Gauge} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
                {DIFFICULTIES.map((d) => {
                  const active = d.id === difficultyId
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficultyId(d.id)}
                      aria-pressed={active}
                      className={cn(
                        'rounded-md border bg-card/70 p-3 text-left backdrop-blur transition-colors hover:border-primary/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none',
                        active && 'border-primary bg-card',
                        active && d.id === 'nightmare' && 'border-destructive',
                      )}
                    >
                      <div className={cn('font-display text-sm font-semibold', d.id === 'nightmare' && 'text-destructive')}>{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.description}</div>
                    </button>
                  )
                })}
              </div>
            </section>

            <div className="rounded-md border bg-card/70 p-4 backdrop-blur">
              <Button size="lg" className="h-14 w-full font-display text-lg font-bold uppercase tracking-[0.2em]" onClick={() => onDeploy({ classId, weaponId, arenaId, difficultyId })}>
                Deploy
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                {pclass.name} · {WEAPONS[weaponId].name} · {ARENAS.find((a) => a.id === arenaId)!.name} · {DIFFICULTIES.find((d) => d.id === difficultyId)!.name}
              </p>
            </div>

            <Controls />
          </div>
        </div>
      </div>
    </div>
  )
}

export function Controls({ className }: { className?: string }) {
  const rows: [string, string][] = [
    ['WASD', 'Move'],
    ['Mouse', 'Look'],
    ['LMB', 'Fire'],
    ['RMB', 'Aim down sights'],
    ['Shift', 'Sprint'],
    ['Space', 'Jump / release hook'],
    ['C', 'Crouch'],
    ['R', 'Reload'],
    ['1 / 2 / Wheel', 'Switch weapon'],
    ['E', 'Swap for dropped weapon'],
    ['Q / F / G', 'Class skills'],
    ['Esc', 'Pause'],
  ]
  return (
    <div className={cn('rounded-md border bg-card/60 p-4 backdrop-blur', className)}>
      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Controls · keyboard & mouse</div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="font-display text-xs font-semibold text-primary">{k}</dt>
            <dd className="text-right text-xs text-muted-foreground">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
