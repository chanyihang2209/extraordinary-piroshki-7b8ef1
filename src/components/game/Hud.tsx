import type { HudState } from '@/game/types'
import { cn } from '@/lib/utils'

function Crosshair({ hud }: { hud: HudState }) {
  if (hud.scoped) return null
  if (hud.ads > 0.6 && !hud.melee) {
    return <div className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
  }
  const gap = 6 + Math.min(60, hud.spread * 700)
  const line = 'absolute bg-white shadow-[0_0_2px_rgba(0,0,0,0.9)]'
  return (
    <div className="absolute top-1/2 left-1/2" style={{ opacity: hud.melee ? 0.6 : 0.9 }}>
      {hud.melee ? (
        <div className="size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" />
      ) : (
        <>
          <div className={line} style={{ width: 2, height: 9, left: -1, top: -gap - 9 }} />
          <div className={line} style={{ width: 2, height: 9, left: -1, top: gap }} />
          <div className={line} style={{ width: 9, height: 2, top: -1, left: -gap - 9 }} />
          <div className={line} style={{ width: 9, height: 2, top: -1, left: gap }} />
        </>
      )}
    </div>
  )
}

function HitMarker({ hud }: { hud: HudState }) {
  if (hud.hitMarker <= 0.01 && hud.headshotMarker <= 0.01) return null
  const head = hud.headshotMarker > 0.01
  const color = head ? '#ef4444' : '#ffffff'
  const o = Math.max(hud.hitMarker, hud.headshotMarker)
  const arm = (rot: number) => (
    <div className="absolute" style={{ width: 2, height: 10, background: color, left: -1, top: -5, transform: `rotate(${rot}deg) translateY(-11px)`, transformOrigin: '1px 5px' }} />
  )
  return (
    <div className="absolute top-1/2 left-1/2" style={{ opacity: o }}>
      {arm(45)}
      {arm(135)}
      {arm(225)}
      {arm(315)}
      {head && <div className="hud-text absolute top-6 left-1/2 -translate-x-1/2 text-xs font-bold tracking-widest whitespace-nowrap text-red-500">HEADSHOT</div>}
    </div>
  )
}

function ScopeOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at center, transparent 0, transparent 34vmin, rgba(0,0,0,0.95) 34.4vmin, #000 36vmin)' }} />
      <div className="absolute top-1/2 left-0 h-px w-full bg-black/80" />
      <div className="absolute top-0 left-1/2 h-full w-px bg-black/80" />
      <div className="absolute top-1/2 left-1/2 h-[3px] w-[12vmin] -translate-y-1/2 translate-x-[8vmin] bg-black" />
      <div className="absolute top-1/2 left-1/2 h-[3px] w-[12vmin] -translate-x-[20vmin] -translate-y-1/2 bg-black" />
      <div className="absolute top-1/2 left-1/2 h-[12vmin] w-[3px] -translate-x-1/2 translate-y-[8vmin] bg-black" />
      <div className="absolute top-1/2 left-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500" />
    </div>
  )
}

export function Hud({ hud, accent }: { hud: HudState; accent: string }) {
  const hpPct = Math.max(0, hud.health / hud.maxHealth)
  const low = hpPct < 0.3
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
      {/* screen tints */}
      {hud.invisible && <div className="absolute inset-0 bg-violet-500/10 shadow-[inset_0_0_160px_rgba(139,92,246,0.55)]" />}
      {hud.focused && <div className="absolute inset-0 bg-cyan-400/10 shadow-[inset_0_0_200px_rgba(34,211,238,0.5)]" />}
      {hud.armored && <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(96,165,250,0.6)]" />}
      <div
        className="absolute inset-0"
        style={{
          opacity: Math.min(1, hud.damageFlash + (low ? 0.35 : 0)),
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(185,28,28,0.75) 100%)',
        }}
      />

      {hud.scoped && <ScopeOverlay />}
      <Crosshair hud={hud} />
      <HitMarker hud={hud} />

      {/* damage direction */}
      {hud.damageAngles.map((a, i) => (
        <div key={i} className="absolute top-1/2 left-1/2 size-0" style={{ transform: `rotate(${a}rad)` }}>
          <div className="absolute -left-10 h-3 w-20 rounded-full bg-red-500/70 blur-[2px]" style={{ top: -170 }} />
        </div>
      ))}

      {/* top center: wave */}
      <div className="hud-text absolute top-4 left-1/2 -translate-x-1/2 text-center">
        <div className="text-xs tracking-[0.35em] text-white/70">
          WAVE {hud.wave}/{hud.totalWaves}
        </div>
        <div className="text-2xl font-bold text-white">{hud.enemiesLeft} HOSTILES</div>
        <div className="text-xs tracking-widest text-amber-300">
          {hud.score.toLocaleString()} PTS · {formatTime(hud.time)}
        </div>
      </div>

      {hud.waveBanner && (
        <div className="hud-text absolute top-[28%] left-1/2 w-full -translate-x-1/2 text-center text-2xl font-bold tracking-[0.25em] text-amber-300 sm:text-4xl" style={{ animation: 'hud-pop 0.35s ease-out' }}>
          {hud.waveBanner}
        </div>
      )}

      {/* kill feed */}
      <div className="hud-text absolute top-4 right-4 flex w-72 flex-col items-end gap-1">
        {hud.killFeed.map((k) => (
          <div key={k.id} className={cn('rounded bg-black/50 px-2 py-1 text-xs font-semibold tracking-wide', k.headshot ? 'text-red-400' : 'text-white')}>
            {k.text}
          </div>
        ))}
      </div>

      {hud.pickupPrompt && (
        <div className="hud-text absolute top-[62%] left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1.5 text-sm font-semibold text-white">
          {hud.pickupPrompt}
        </div>
      )}
      {hud.reloading && (
        <div className="absolute top-[57%] left-1/2 h-1 w-28 -translate-x-1/2 overflow-hidden rounded-full bg-black/50">
          <div className="h-full bg-amber-300" style={{ width: `${hud.reloadProgress * 100}%` }} />
        </div>
      )}

      {/* bottom left: health & status */}
      <div className="hud-text absolute bottom-5 left-5 w-64">
        <div className="mb-1 flex flex-wrap gap-1">
          {hud.invisible && <Chip color="#a78bfa">INVISIBLE</Chip>}
          {hud.armored && <Chip color="#60a5fa">IRON WALL</Chip>}
          {hud.focused && <Chip color="#22d3ee">FOCUS</Chip>}
          {hud.pulsing && <Chip color="#f87171">PULSE</Chip>}
          {hud.grappling && <Chip color="#d6d3d1">HOOKED</Chip>}
        </div>
        <div className="flex items-end gap-3">
          <div className={cn('text-4xl leading-none font-bold', low ? 'text-red-400' : 'text-white')}>{hud.health}</div>
          <div className="pb-1 text-xs tracking-widest text-white/60">/ {hud.maxHealth} HP</div>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-black/50">
          <div className="h-full transition-[width] duration-150" style={{ width: `${hpPct * 100}%`, background: low ? '#ef4444' : accent }} />
        </div>
      </div>

      {/* bottom center: skills */}
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-2">
        {hud.skills.map((s) => (
          <div key={s.id} className={cn('hud-text relative w-24 overflow-hidden rounded border bg-black/55 px-2 py-1.5', s.ready >= 1 ? 'border-white/40' : 'border-white/10', s.active && 'border-amber-300')}>
            <div className="absolute inset-x-0 bottom-0 bg-white/10" style={{ height: `${s.ready * 100}%` }} />
            <div className="relative flex items-center justify-between">
              <span className="rounded bg-white/15 px-1 text-xs font-bold text-amber-300">{s.key}</span>
              {s.maxCharges ? (
                <span className="text-xs font-bold text-white">
                  {s.charges}/{s.maxCharges}
                </span>
              ) : s.ready < 1 ? (
                <span className="text-[10px] text-white/60">{Math.round(s.ready * 100)}%</span>
              ) : null}
            </div>
            <div className={cn('relative mt-0.5 truncate text-[11px] font-semibold', s.ready >= 1 || (s.charges ?? 0) > 0 ? 'text-white' : 'text-white/50')}>{s.name}</div>
          </div>
        ))}
      </div>

      {/* bottom right: weapon */}
      <div className="hud-text absolute right-5 bottom-5 text-right">
        <div className="mb-1 flex justify-end gap-1">
          {hud.slots.map((s, i) => (
            <span key={i} className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', i === hud.slot ? 'bg-white/90 text-black' : 'bg-black/50 text-white/60')}>
              {i + 1} {s.name}
            </span>
          ))}
        </div>
        <div className="text-sm font-semibold tracking-wider text-white/80">{hud.weaponName}</div>
        {hud.melee ? (
          <div className="text-3xl font-bold text-white">∞</div>
        ) : (
          <div className="flex items-baseline justify-end gap-1">
            <span className={cn('text-4xl leading-none font-bold', hud.mag === 0 ? 'text-red-400' : 'text-white')}>{hud.mag}</span>
            <span className="text-lg text-white/60">/ {hud.reserve}</span>
          </div>
        )}
        {!hud.melee && hud.mag === 0 && hud.reserve === 0 && <div className="text-xs font-bold text-red-400">NO AMMO — PICK UP A WEAPON</div>}
      </div>
    </div>
  )
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-black" style={{ background: color }}>
      {children}
    </span>
  )
}

export function formatTime(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
