import * as THREE from 'three'
import type { ArenaDef } from './data'

export const CELL = 3

export interface Collider {
  min: THREE.Vector3
  max: THREE.Vector3
}

export interface World {
  group: THREE.Group
  colliders: Collider[]
  /** meshes bullets and projectiles collide with */
  solids: THREE.Object3D[]
  playerSpawn: THREE.Vector3
  enemySpawns: THREE.Vector3[]
  healthSpawns: THREE.Vector3[]
  cols: number
  rows: number
  /** true when bullets/vision are blocked by this cell */
  sightBlocked: boolean[]
  /** true when ground units cannot walk through this cell */
  walkBlocked: boolean[]
  weather: THREE.Points | null
  weatherKind: 'snow' | 'rain' | 'dust' | null
  dispose: () => void
}

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, repeat = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')!
  draw(g, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat, repeat)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0')

function noiseFill(g: CanvasRenderingContext2D, s: number, base: number, amount: number) {
  g.fillStyle = hex(base)
  g.fillRect(0, 0, s, s)
  const img = g.getImageData(0, 0, s, s)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
}

export function buildWorld(arena: ArenaDef): World {
  const group = new THREE.Group()
  const colliders: Collider[] = []
  const solids: THREE.Object3D[] = []
  const disposables: { dispose: () => void }[] = []
  const rows = arena.map.length
  const cols = arena.map[0].length
  const sightBlocked: boolean[] = new Array(rows * cols).fill(false)
  const walkBlocked: boolean[] = new Array(rows * cols).fill(false)
  const enemySpawns: THREE.Vector3[] = []
  const healthSpawns: THREE.Vector3[] = []
  let playerSpawn = new THREE.Vector3(cols * CELL * 0.5, 0, rows * CELL * 0.5)

  // --- textures & materials ---
  const floorTex = canvasTexture(256, (g, s) => {
    noiseFill(g, s, arena.floor, 18)
    g.strokeStyle = hex(arena.floorLine)
    g.lineWidth = 3
    g.strokeRect(0, 0, s, s)
  }, 1)
  floorTex.repeat.set(cols, rows)
  const wallTex = canvasTexture(256, (g, s) => {
    noiseFill(g, s, arena.wall, 22)
    g.fillStyle = 'rgba(0,0,0,0.18)'
    for (let y = 0; y < s; y += 32) g.fillRect(0, y, s, 2)
    for (let y = 0; y < s; y += 32) for (let x = (y / 32) % 2 ? 0 : 32; x < s; x += 64) g.fillRect(x, y, 2, 32)
  })
  const crateTex = canvasTexture(128, (g, s) => {
    noiseFill(g, s, arena.crate, 26)
    g.strokeStyle = 'rgba(0,0,0,0.45)'
    g.lineWidth = 8
    g.strokeRect(4, 4, s - 8, s - 8)
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(8, 8)
    g.lineTo(s - 8, s - 8)
    g.stroke()
  })
  disposables.push(floorTex, wallTex, crateTex)

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: arena.id === 'neon' ? 0.35 : 0.95, metalness: arena.id === 'neon' ? 0.3 : 0 })
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })
  const crateMat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.85 })
  const pillarMat = new THREE.MeshStandardMaterial({ color: arena.pillar, roughness: 0.7, metalness: 0.1 })
  disposables.push(floorMat, wallMat, crateMat, pillarMat)

  // --- floor ---
  const floorGeo = new THREE.PlaneGeometry(cols * CELL, rows * CELL)
  const floor = new THREE.Mesh(floorGeo, floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set((cols * CELL) / 2, 0, (rows * CELL) / 2)
  floor.receiveShadow = true
  floor.userData.surface = 'floor'
  group.add(floor)
  solids.push(floor)
  disposables.push(floorGeo)

  const addBox = (x0: number, z0: number, x1: number, z1: number, h: number, mat: THREE.Material, yBase = 0) => {
    const w = x1 - x0
    const d = z1 - z0
    const geo = new THREE.BoxGeometry(w, h, d)
    // scale UVs so textures tile per-meter rather than stretch
    const uv = geo.attributes.uv as THREE.BufferAttribute
    const normal = geo.attributes.normal as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const nx = Math.abs(normal.getX(i))
      const ny = Math.abs(normal.getY(i))
      const su = ny > 0.5 ? w : nx > 0.5 ? d : w
      const sv = ny > 0.5 ? d : h
      uv.setXY(i, (uv.getX(i) * su) / 3, (uv.getY(i) * sv) / 3)
    }
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(x0 + w / 2, yBase + h / 2, z0 + d / 2)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    solids.push(mesh)
    colliders.push({ min: new THREE.Vector3(x0, yBase, z0), max: new THREE.Vector3(x1, yBase + h, z1) })
    disposables.push(geo)
    return mesh
  }

  const pillarGeo = new THREE.CylinderGeometry(0.75, 0.85, arena.wallHeight, 14)
  disposables.push(pillarGeo)

  for (let r = 0; r < rows; r++) {
    const line = arena.map[r]
    // merge runs of walls along the row
    let c = 0
    while (c < cols) {
      if (line[c] === '#') {
        let end = c
        while (end + 1 < cols && line[end + 1] === '#') end++
        addBox(c * CELL, r * CELL, (end + 1) * CELL, (r + 1) * CELL, arena.wallHeight, wallMat)
        for (let k = c; k <= end; k++) {
          sightBlocked[r * cols + k] = true
          walkBlocked[r * cols + k] = true
        }
        c = end + 1
        continue
      }
      const ch = line[c]
      const cx = c * CELL + CELL / 2
      const cz = r * CELL + CELL / 2
      const idx = r * cols + c
      if (ch === 'C') {
        const s = CELL * 0.44
        const m = addBox(cx - s, cz - s, cx + s, cz + s, 2.6, crateMat)
        m.rotation.y = 0 // keep axis aligned with collider
        sightBlocked[idx] = true
        walkBlocked[idx] = true
      } else if (ch === 'c') {
        const s = CELL * 0.36
        addBox(cx - s, cz - s, cx + s, cz + s, 1.05, crateMat)
        walkBlocked[idx] = true
      } else if (ch === 'o') {
        const p = new THREE.Mesh(pillarGeo, pillarMat)
        p.position.set(cx, arena.wallHeight / 2, cz)
        p.castShadow = p.receiveShadow = true
        group.add(p)
        solids.push(p)
        colliders.push({ min: new THREE.Vector3(cx - 0.8, 0, cz - 0.8), max: new THREE.Vector3(cx + 0.8, arena.wallHeight, cz + 0.8) })
        sightBlocked[idx] = true
        walkBlocked[idx] = true
      } else if (ch === 'P') {
        playerSpawn = new THREE.Vector3(cx, 0, cz)
      } else if (ch === 'E') {
        enemySpawns.push(new THREE.Vector3(cx, 0, cz))
      } else if (ch === 'H') {
        healthSpawns.push(new THREE.Vector3(cx, 0, cz))
      }
      c++
    }
  }

  // --- neon accents: glowing strips & signs on walls ---
  if (arena.accents) {
    const rng = mulberry(7)
    let lights = 0
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (arena.map[r][c] !== '#' || rng() > 0.22) continue
        // find an open face
        const faces: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]]
        const open = faces.filter(([dc, dr]) => !sightBlocked[(r + dr) * cols + (c + dc)])
        if (!open.length) continue
        const [dc, dr] = open[Math.floor(rng() * open.length)]
        const color = arena.accents[Math.floor(rng() * arena.accents.length)]
        const mat = new THREE.MeshBasicMaterial({ color })
        disposables.push(mat)
        const w = dc === 0 ? CELL * 0.8 : 0.08
        const d = dr === 0 ? CELL * 0.8 : 0.08
        const geo = new THREE.BoxGeometry(w, 0.5 + rng() * 1.2, d)
        disposables.push(geo)
        const sign = new THREE.Mesh(geo, mat)
        sign.position.set(c * CELL + CELL / 2 + dc * (CELL / 2 + 0.05), 3 + rng() * 4, r * CELL + CELL / 2 + dr * (CELL / 2 + 0.05))
        group.add(sign)
        if (lights < 5 && rng() > 0.35) {
          const light = new THREE.PointLight(color, 25, 16, 2)
          light.position.copy(sign.position).add(new THREE.Vector3(dc * 1.2, -1, dr * 1.2))
          group.add(light)
          lights++
        }
      }
    }
  }

  // --- lighting ---
  const ambient = new THREE.HemisphereLight(arena.ambient, arena.floor, arena.ambientIntensity)
  group.add(ambient)
  const sun = new THREE.DirectionalLight(arena.sun, arena.sunIntensity)
  const cx = (cols * CELL) / 2
  const cz = (rows * CELL) / 2
  sun.position.set(cx + 30, 60, cz + 20)
  sun.target.position.set(cx, 0, cz)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const half = Math.max(cols, rows) * CELL * 0.6
  sun.shadow.camera.left = -half
  sun.shadow.camera.right = half
  sun.shadow.camera.top = half
  sun.shadow.camera.bottom = -half
  sun.shadow.camera.near = 10
  sun.shadow.camera.far = 160
  sun.shadow.bias = -0.0008
  group.add(sun, sun.target)

  // --- weather particles ---
  let weather: THREE.Points | null = null
  let weatherKind: World['weatherKind'] = null
  if (arena.id === 'bunker' || arena.id === 'neon' || arena.id === 'outpost') {
    weatherKind = arena.id === 'bunker' ? 'snow' : arena.id === 'neon' ? 'rain' : 'dust'
    const count = weatherKind === 'dust' ? 600 : 2500
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = Math.random() * cols * CELL
      pos[i * 3 + 1] = Math.random() * 20
      pos[i * 3 + 2] = Math.random() * rows * CELL
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.PointsMaterial({
      color: weatherKind === 'rain' ? 0x9fb6ff : weatherKind === 'dust' ? 0xf3dcb4 : 0xffffff,
      size: weatherKind === 'rain' ? 0.06 : weatherKind === 'dust' ? 0.08 : 0.12,
      transparent: true,
      opacity: weatherKind === 'rain' ? 0.6 : 0.85,
      depthWrite: false,
    })
    weather = new THREE.Points(geo, mat)
    group.add(weather)
    disposables.push(geo, mat)
  }

  return {
    group,
    colliders,
    solids,
    playerSpawn,
    enemySpawns,
    healthSpawns,
    cols,
    rows,
    sightBlocked,
    walkBlocked,
    weather,
    weatherKind,
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}

export function updateWeather(world: World, dt: number) {
  if (!world.weather) return
  const attr = world.weather.geometry.attributes.position as THREE.BufferAttribute
  const arr = attr.array as Float32Array
  const fall = world.weatherKind === 'rain' ? 22 : world.weatherKind === 'snow' ? 1.6 : 0.3
  const drift = world.weatherKind === 'dust' ? 2.5 : world.weatherKind === 'snow' ? 0.6 : 0
  const w = world.cols * CELL
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 1] -= fall * dt
    arr[i] += drift * dt
    if (arr[i + 1] < 0) arr[i + 1] += 20
    if (arr[i] > w) arr[i] -= w
  }
  attr.needsUpdate = true
}

function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function cellOf(x: number, z: number): [number, number] {
  return [Math.floor(x / CELL), Math.floor(z / CELL)]
}

function blockedAt(world: World, grid: boolean[], x: number, z: number) {
  const c = Math.floor(x / CELL)
  const r = Math.floor(z / CELL)
  if (c < 0 || r < 0 || c >= world.cols || r >= world.rows) return true
  return grid[r * world.cols + c]
}

/** Line of sight across the grid, ignoring low cover. */
export function hasLineOfSight(world: World, a: THREE.Vector3, b: THREE.Vector3) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const dist = Math.hypot(dx, dz)
  const steps = Math.ceil(dist / 0.4)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (blockedAt(world, world.sightBlocked, a.x + dx * t, a.z + dz * t)) return false
  }
  return true
}

/** Whether a ground unit of the given radius can walk in a straight line between two points. */
export function canWalkStraight(world: World, a: THREE.Vector3, b: THREE.Vector3, radius = 0.45) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.01) return true
  const nx = -dz / dist
  const nz = dx / dist
  const steps = Math.ceil(dist / 0.5)
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = a.x + dx * t
    const z = a.z + dz * t
    if (
      blockedAt(world, world.walkBlocked, x + nx * radius, z + nz * radius) ||
      blockedAt(world, world.walkBlocked, x - nx * radius, z - nz * radius)
    )
      return false
  }
  return true
}

/** A* over the walkable grid. Returns world-space waypoints (excluding the start). */
export function findPath(world: World, from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
  const { cols, rows, walkBlocked } = world
  let [sc, sr] = cellOf(from.x, from.z)
  let [ec, er] = cellOf(to.x, to.z)
  const clampCell = (c: number, r: number): [number, number] => {
    if (!walkBlocked[r * cols + c]) return [c, r]
    // nudge to nearest open neighbour
    for (let rad = 1; rad < 4; rad++)
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          const nc = c + dc
          const nr = r + dr
          if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && !walkBlocked[nr * cols + nc]) return [nc, nr]
        }
    return [c, r]
  }
  ;[sc, sr] = clampCell(sc, sr)
  ;[ec, er] = clampCell(ec, er)
  const start = sr * cols + sc
  const goal = er * cols + ec
  if (start === goal) return [to.clone()]

  const g = new Float32Array(cols * rows).fill(Infinity)
  const f = new Float32Array(cols * rows).fill(Infinity)
  const came = new Int32Array(cols * rows).fill(-1)
  const closed = new Uint8Array(cols * rows)
  const open: number[] = [start]
  g[start] = 0
  const h = (i: number) => {
    const c = i % cols
    const r = (i / cols) | 0
    return Math.hypot(c - ec, r - er)
  }
  f[start] = h(start)
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  let iterations = 0
  while (open.length && iterations++ < 4000) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i
    const cur = open[bi]
    open.splice(bi, 1)
    if (cur === goal) break
    closed[cur] = 1
    const cc = cur % cols
    const cr = (cur / cols) | 0
    for (const [dc, dr] of dirs) {
      const nc = cc + dc
      const nr = cr + dr
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue
      const ni = nr * cols + nc
      if (walkBlocked[ni] || closed[ni]) continue
      if (dc && dr && (walkBlocked[cr * cols + nc] || walkBlocked[nr * cols + cc])) continue
      const ng = g[cur] + (dc && dr ? 1.414 : 1)
      if (ng < g[ni]) {
        g[ni] = ng
        f[ni] = ng + h(ni)
        came[ni] = cur
        if (!open.includes(ni)) open.push(ni)
      }
    }
  }
  if (came[goal] === -1) return []
  const cells: number[] = []
  for (let i = goal; i !== start && i !== -1; i = came[i]) cells.push(i)
  cells.reverse()
  const pts = cells.map((i) => new THREE.Vector3((i % cols) * CELL + CELL / 2, 0, ((i / cols) | 0) * CELL + CELL / 2))
  pts[pts.length - 1] = to.clone().setY(0)
  return pts
}

export function randomWalkablePoint(world: World): THREE.Vector3 {
  for (let i = 0; i < 200; i++) {
    const c = 1 + Math.floor(Math.random() * (world.cols - 2))
    const r = 1 + Math.floor(Math.random() * (world.rows - 2))
    if (!world.walkBlocked[r * world.cols + c]) return new THREE.Vector3(c * CELL + CELL / 2, 0, r * CELL + CELL / 2)
  }
  return new THREE.Vector3((world.cols * CELL) / 2, 0, (world.rows * CELL) / 2)
}

/**
 * Moves an axis-aligned box (feet position, radius, height) through the colliders,
 * resolving each axis in turn. Returns whether the body ended up on the ground.
 */
export function moveBody(
  colliders: Collider[],
  pos: THREE.Vector3,
  vel: THREE.Vector3,
  dt: number,
  radius: number,
  height: number,
  stepHeight = 0.35,
): { onGround: boolean; hitWall: boolean; hitCeiling: boolean } {
  let onGround = false
  let hitWall = false
  let hitCeiling = false
  const overlaps = (c: Collider) =>
    pos.x + radius > c.min.x &&
    pos.x - radius < c.max.x &&
    pos.z + radius > c.min.z &&
    pos.z - radius < c.max.z &&
    pos.y + height > c.min.y &&
    pos.y < c.max.y

  // horizontal axes
  for (const axis of ['x', 'z'] as const) {
    const d = vel[axis] * dt
    if (d === 0) continue
    pos[axis] += d
    for (const c of colliders) {
      if (!overlaps(c)) continue
      // auto step onto short ledges
      if (c.max.y - pos.y <= stepHeight && c.max.y - pos.y > 0) {
        pos.y = c.max.y
        continue
      }
      if (d > 0) pos[axis] = c.min[axis] - radius - 0.001
      else pos[axis] = c.max[axis] + radius + 0.001
      hitWall = true
    }
  }

  // vertical
  const dy = vel.y * dt
  pos.y += dy
  for (const c of colliders) {
    if (!overlaps(c)) continue
    if (dy <= 0) {
      pos.y = c.max.y
      onGround = true
    } else {
      pos.y = c.min.y - height - 0.001
      hitCeiling = true
    }
    vel.y = 0
  }
  if (pos.y <= 0) {
    pos.y = 0
    if (vel.y < 0) vel.y = 0
    onGround = true
  }
  return { onGround, hitWall, hitCeiling }
}
