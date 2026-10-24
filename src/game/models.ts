import * as THREE from 'three'
import type { WeaponId } from './data'

export interface GunModel {
  group: THREE.Group
  muzzle: THREE.Object3D
  /** height of the sight line above the model origin, used to center ADS */
  sightHeight: number
  materials: THREE.Material[]
}

interface GunSpec {
  body: [number, number, number]
  barrel: number
  barrelRadius: number
  mag?: [number, number, number, number] // w, h, d, z offset
  stock?: number
  sight?: 'iron' | 'dot' | 'scope' | 'bigscope'
  pump?: boolean
  drum?: boolean
}

const SPECS: Record<Exclude<WeaponId, 'katana'>, GunSpec> = {
  pistol: { body: [0.05, 0.075, 0.2], barrel: 0.03, barrelRadius: 0.011, mag: [0.04, 0.11, 0.05, 0.05], sight: 'iron' },
  revolver: { body: [0.05, 0.07, 0.16], barrel: 0.16, barrelRadius: 0.014, drum: true, sight: 'iron' },
  smg: { body: [0.06, 0.09, 0.34], barrel: 0.08, barrelRadius: 0.014, mag: [0.035, 0.2, 0.05, -0.02], stock: 0.16, sight: 'dot' },
  rifle: { body: [0.06, 0.1, 0.5], barrel: 0.24, barrelRadius: 0.013, mag: [0.04, 0.2, 0.07, -0.04], stock: 0.24, sight: 'dot' },
  shotgun: { body: [0.07, 0.09, 0.45], barrel: 0.36, barrelRadius: 0.022, stock: 0.26, sight: 'iron', pump: true },
  dmr: { body: [0.06, 0.1, 0.55], barrel: 0.3, barrelRadius: 0.014, mag: [0.04, 0.12, 0.07, -0.05], stock: 0.26, sight: 'scope' },
  sniper: { body: [0.065, 0.1, 0.62], barrel: 0.5, barrelRadius: 0.016, mag: [0.04, 0.09, 0.08, -0.05], stock: 0.3, sight: 'bigscope' },
  lmg: { body: [0.09, 0.13, 0.6], barrel: 0.36, barrelRadius: 0.02, mag: [0.11, 0.12, 0.12, -0.02], stock: 0.26, sight: 'dot' },
}

export function buildGunModel(id: WeaponId, color: number): GunModel {
  const group = new THREE.Group()
  const muzzle = new THREE.Object3D()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.55 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, metalness: 0.4 })
  const accent = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 0.8 })
  const materials: THREE.Material[] = [mat, dark, accent]

  if (id === 'katana') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, 0.95), new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.15, metalness: 1 }))
    blade.position.set(0, 0, -0.55)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.015), new THREE.MeshStandardMaterial({ color: 0xb08a3c, metalness: 0.8, roughness: 0.3 }))
    guard.position.z = -0.06
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 8), new THREE.MeshStandardMaterial({ color: 0x1b1036, roughness: 0.9 }))
    handle.rotation.x = Math.PI / 2
    handle.position.z = 0.07
    group.add(blade, guard, handle)
    materials.push(blade.material, guard.material, handle.material)
    muzzle.position.set(0, 0, -1)
    group.add(muzzle)
    return { group, muzzle, sightHeight: 0, materials }
  }

  const s = SPECS[id]
  const [bw, bh, bl] = s.body
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bl), mat)
  body.position.set(0, 0, -bl / 2)
  group.add(body)

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(s.barrelRadius, s.barrelRadius, s.barrel, 10), dark)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, bh * 0.15, -bl - s.barrel / 2)
  group.add(barrel)
  muzzle.position.set(0, bh * 0.15, -bl - s.barrel - 0.02)
  group.add(muzzle)

  const grip = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, 0.12, 0.05), id === 'pistol' || id === 'revolver' ? dark : accent)
  grip.position.set(0, -bh / 2 - 0.05, -0.02)
  grip.rotation.x = 0.25
  group.add(grip)

  if (s.mag) {
    const [mw, mh, md, mz] = s.mag
    const mag = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, md), dark)
    mag.position.set(0, -bh / 2 - mh / 2 + 0.02, -bl / 2 + mz - (id === 'pistol' ? -0.03 : 0))
    if (id === 'rifle') mag.rotation.x = -0.18
    if (id === 'pistol') mag.visible = false
    group.add(mag)
  }
  if (s.drum) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), dark)
    drum.rotation.x = Math.PI / 2
    drum.position.set(0, 0, -bl * 0.45)
    group.add(drum)
  }
  if (s.stock) {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, bh * 0.9, s.stock), id === 'shotgun' || id === 'sniper' ? accent : mat)
    stock.position.set(0, -0.01, s.stock / 2)
    group.add(stock)
  }
  if (s.pump) {
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 10), accent)
    pump.rotation.x = Math.PI / 2
    pump.position.set(0, -0.02, -bl - 0.1)
    group.add(pump)
  }

  let sightHeight = bh / 2 + 0.015
  if (s.sight === 'iron') {
    const front = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.01), dark)
    front.position.set(0, bh / 2 + 0.01, -bl + 0.01)
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), dark)
    rear.position.set(0, bh / 2 + 0.01, -0.01)
    group.add(front, rear)
    sightHeight = bh / 2 + 0.018
  } else if (s.sight === 'dot') {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.07), dark)
    housing.position.set(0, bh / 2 + 0.025, -bl * 0.45)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.15 }))
    glass.position.set(0, bh / 2 + 0.028, -bl * 0.45 + 0.036)
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0022, 8), new THREE.MeshBasicMaterial({ color: 0xff2020 }))
    dot.position.set(0, bh / 2 + 0.028, -bl * 0.45 - 0.03)
    group.add(housing, glass, dot)
    materials.push(glass.material, dot.material)
    sightHeight = bh / 2 + 0.028
  } else {
    const big = s.sight === 'bigscope'
    const r = big ? 0.028 : 0.022
    const len = big ? 0.3 : 0.22
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), dark)
    tube.rotation.x = Math.PI / 2
    tube.position.set(0, bh / 2 + r + 0.012, -bl * 0.45)
    const lens = new THREE.Mesh(new THREE.CircleGeometry(r * 0.9, 12), new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 1, roughness: 0.1, emissive: 0x0a1030 }))
    lens.position.set(0, bh / 2 + r + 0.012, -bl * 0.45 - len / 2 - 0.001)
    lens.rotation.y = Math.PI
    group.add(tube, lens)
    materials.push(lens.material)
    sightHeight = bh / 2 + r + 0.012
  }

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  return { group, muzzle, sightHeight, materials }
}

export interface EnemyModel {
  group: THREE.Group
  /** rotates toward the aim target (upper body) */
  torso: THREE.Group
  legs: THREE.Mesh[]
  hitParts: THREE.Mesh[]
  materials: THREE.MeshStandardMaterial[]
  muzzle: THREE.Object3D
  headHeight: number
}

export function buildEnemyModel(color: number, weaponId: WeaponId, weaponColor: number, scale: number): EnemyModel {
  const group = new THREE.Group()
  const torso = new THREE.Group()
  const uniform = new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  const gear = new THREE.MeshStandardMaterial({ color: 0x23252a, roughness: 0.8 })
  const skin = new THREE.MeshStandardMaterial({ color: 0xc89a7a, roughness: 0.8 })
  const visor = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff3a20, emissiveIntensity: 1.4, roughness: 0.3 })
  const materials = [uniform, gear, skin, visor]

  const legGeo = new THREE.BoxGeometry(0.2, 0.9, 0.24)
  const legL = new THREE.Mesh(legGeo, gear)
  const legR = new THREE.Mesh(legGeo, gear)
  legL.geometry.translate(0, -0.45, 0)
  legL.position.set(-0.13, 0.9, 0)
  legR.position.set(0.13, 0.9, 0)
  group.add(legL, legR)

  torso.position.y = 0.9
  group.add(torso)
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.32), uniform)
  chest.position.y = 0.35
  const vest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.36), gear)
  vest.position.y = 0.4
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin)
  head.position.y = 0.88
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.36), uniform)
  helmet.position.y = 1.06
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.06, 0.02), visor)
  eye.position.set(0, 0.92, -0.16)
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.5), uniform)
  armL.position.set(-0.22, 0.52, -0.22)
  armL.rotation.y = -0.35
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.45), uniform)
  armR.position.set(0.24, 0.5, -0.18)
  torso.add(chest, vest, head, helmet, eye, armL, armR)

  const gun = buildGunModel(weaponId, weaponColor)
  gun.group.scale.setScalar(1.4)
  gun.group.position.set(0.12, 0.55, -0.42)
  torso.add(gun.group)
  materials.push(...(gun.materials.filter((m) => m instanceof THREE.MeshStandardMaterial) as THREE.MeshStandardMaterial[]))

  for (const m of [chest, vest, armL, armR, legL, legR]) m.userData.part = 'body'
  for (const m of [head, helmet, eye]) m.userData.part = 'head'
  const hitParts = [chest, vest, armL, armR, legL, legR, head, helmet, eye]
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true
  })
  group.scale.setScalar(scale)
  return { group, torso, legs: [legL, legR], hitParts, materials, muzzle: gun.muzzle, headHeight: (0.9 + 0.88) * scale }
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.Line || o instanceof THREE.Sprite) {
      o.geometry?.dispose()
      const m = o.material as THREE.Material | THREE.Material[]
      if (Array.isArray(m)) m.forEach((x) => x.dispose())
      else m?.dispose()
    }
  })
}

let markerTex: THREE.Texture | null = null
export function markerTexture(): THREE.Texture {
  if (markerTex) return markerTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.strokeStyle = '#ff3b3b'
  g.lineWidth = 6
  g.beginPath()
  g.moveTo(32, 6)
  g.lineTo(58, 32)
  g.lineTo(32, 58)
  g.lineTo(6, 32)
  g.closePath()
  g.stroke()
  g.fillStyle = '#ff3b3b'
  g.beginPath()
  g.arc(32, 32, 7, 0, Math.PI * 2)
  g.fill()
  markerTex = new THREE.CanvasTexture(c)
  return markerTex
}

let alertTex: THREE.Texture | null = null
export function alertTexture(): THREE.Texture {
  if (alertTex) return alertTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.fillStyle = '#ffb020'
  g.font = 'bold 56px sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('!', 32, 34)
  alertTex = new THREE.CanvasTexture(c)
  return alertTex
}

let flashTex: THREE.Texture | null = null
export function flashTexture(): THREE.Texture {
  if (flashTex) return flashTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,230,1)')
  grad.addColorStop(0.3, 'rgba(255,200,80,0.9)')
  grad.addColorStop(1, 'rgba(255,120,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  flashTex = new THREE.CanvasTexture(c)
  return flashTex
}
