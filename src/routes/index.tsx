import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { GameConfig } from '@/game/data'
import { LoadoutScreen } from '@/components/game/LoadoutScreen'
import { GameView } from '@/components/game/GameView'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [last, setLast] = useState<GameConfig | undefined>()

  if (config) {
    return (
      <GameView
        config={config}
        onExit={() => {
          setLast(config)
          setConfig(null)
        }}
      />
    )
  }
  return <LoadoutScreen initial={last} onDeploy={setConfig} />
}
