import { useEffect, useRef, useState } from 'react'
import { ARENAS, DIFFICULTIES, PLAYER_CLASSES, WEAPONS, type GameConfig } from '@/game/data'
import type { Game } from '@/game/engine'
import type { HudState } from '@/game/types'
import { Button } from '@/components/ui/button'
import { Controls } from './LoadoutScreen'
import { Hud, formatTime } from './Hud'

export function GameView({ config, onExit }: { config: GameConfig; onExit: () => void }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game | null>(null)
  const [hud, setHud] = useState<HudState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState(0)
  const pclass = PLAYER_CLASSES.find((c) => c.id === config.classId)!

  useEffect(() => {
    let cancelled = false
    let game: Game | null = null
    import('@/game/engine')
      .then(({ Game }) => {
        if (cancelled || !mountRef.current) return
        game = new Game(mountRef.current, config, setHud)
        gameRef.current = game
      })
      .catch(() => setError('Your browser could not start the 3D renderer. Try a recent Chrome, Edge or Firefox with hardware acceleration on.'))
    return () => {
      cancelled = true
      game?.dispose()
      gameRef.current = null
      setHud(null)
    }
  }, [config, run])

  const lock = () => gameRef.current?.requestLock()
  const restart = () => setRun((r) => r + 1)

  const status = hud?.status
  const showStart = hud && status === 'paused' && hud.time === 0
  const showPause = hud && status === 'paused' && hud.time > 0
  const ended = status === 'dead' || status === 'victory'

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={mountRef} className="absolute inset-0" onClick={() => status === 'playing' && !hud?.pointerLocked && lock()} />
      {hud && status !== 'dead' && status !== 'victory' && <Hud hud={hud} accent={pclass.accent} />}

      {!hud && !error && (
        <div className="absolute inset-0 grid place-items-center font-display text-sm tracking-[0.3em] text-muted-foreground">LOADING ARENA…</div>
      )}
      {error && (
        <Overlay>
          <h2 className="font-display text-2xl font-bold">Renderer unavailable</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={onExit}>Back to loadout</Button>
        </Overlay>
      )}

      {showStart && (
        <Overlay onClick={lock}>
          <p className="font-display text-xs tracking-[0.35em] text-primary uppercase">
            {ARENAS.find((a) => a.id === config.arenaId)!.name} · {DIFFICULTIES.find((d) => d.id === config.difficultyId)!.name}
          </p>
          <h2 className="font-display text-4xl font-bold sm:text-5xl">Click to deploy</h2>
          <p className="text-muted-foreground">
            {pclass.name} with the {WEAPONS[config.weaponId].name}. Clear all {ARENAS.find((a) => a.id === config.arenaId)!.waves.length} waves to win.
          </p>
          <Controls className="w-full max-w-md text-left" />
          <Button
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              onExit()
            }}
          >
            Change loadout
          </Button>
        </Overlay>
      )}

      {showPause && (
        <Overlay>
          <h2 className="font-display text-4xl font-bold">Paused</h2>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={lock}>
              Resume
            </Button>
            <Button size="lg" variant="outline" onClick={restart}>
              Restart
            </Button>
            <Button size="lg" variant="ghost" onClick={onExit}>
              Quit to loadout
            </Button>
          </div>
          <Controls className="w-full max-w-md text-left" />
        </Overlay>
      )}

      {ended && hud && (
        <Overlay>
          <p className="font-display text-xs tracking-[0.35em] text-muted-foreground uppercase">
            {status === 'victory' ? 'Arena cleared' : `Fell on wave ${hud.wave}/${hud.totalWaves}`}
          </p>
          <h2 className={`font-display text-5xl font-bold sm:text-6xl ${status === 'victory' ? 'text-primary' : 'text-destructive'}`}>
            {status === 'victory' ? 'VICTORY' : 'K.I.A.'}
          </h2>
          <dl className="grid w-full max-w-lg grid-cols-3 gap-3 sm:grid-cols-5">
            <Stat label="Score" value={hud.score.toLocaleString()} />
            <Stat label="Kills" value={hud.kills} />
            <Stat label="Headshots" value={hud.headshots} />
            <Stat label="Accuracy" value={hud.shotsFired ? `${Math.round((hud.shotsHit / hud.shotsFired) * 100)}%` : '—'} />
            <Stat label="Time" value={formatTime(hud.time)} />
          </dl>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" onClick={restart}>
              {status === 'victory' ? 'Play again' : 'Retry'}
            </Button>
            <Button size="lg" variant="outline" onClick={onExit}>
              Change loadout
            </Button>
          </div>
        </Overlay>
      )}
    </div>
  )
}

function Overlay({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center gap-5 bg-background/80 p-6 text-center backdrop-blur-sm ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-card/70 p-3">
      <dt className="text-[10px] tracking-widest text-muted-foreground uppercase">{label}</dt>
      <dd className="font-display text-xl font-bold">{value}</dd>
    </div>
  )
}
