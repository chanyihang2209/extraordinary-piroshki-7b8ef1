import * as THREE from 'three'
import {
  ARENAS,
  DIFFICULTIES,
  ENEMY_CLASSES,
  PLAYER_CLASSES,
  SKILLS,
  WEAPONS,
  type ArenaDef,
  type DifficultyDef,
  type EnemyClassDef,
  type EnemyClassId,
  type GameConfig,
  type PlayerClassDef,
  type SkillDef,
  type WeaponDef,
  type WeaponId,
} from './data'
import type { GameStatus, HudState, KillFeedEntry } from './types'
import {
  buildWorld,
  canWalkStraight,
  findPath,
  hasLineOfSight,
  moveBody,
  randomWalkablePoint,
  updateWeather,
  type World,
} from './world'
import {
  alertTexture,
  buildEnemyModel,
  buildGunModel,
  disposeObject,
  flashTexture,
  markerTexture,
  type EnemyModel,
  type GunModel,
} from './models'
import { Sfx } from './sfx'

const GRAVITY = 22
const JUMP_SPEED = 7.8
const BASE_SPEED = 6.2
const PLAYER_RADIUS = 0.35
const PLAYER_HEIGHT = 1.75
const EYE = 1.62
const CROUCH_EYE = 1.05
const BASE_FOV = 78
const ENEMY_RADIUS = 0.4

interface WeaponSlot {
  def: WeaponDef
  mag: number
  reserve: number
}

type EnemyState = 'patrol' | 'alert' | 'search'

interface Enemy {
  id: number
  def: EnemyClassDef
  model: EnemyModel
  pos: THREE.Vector3
  vel: THREE.Vector3
  yaw: number
  hp: number
  maxHp: number
  state: EnemyState
  dead: boolean
  deadTimer: number
  lastKnown: THREE.Vector3
  seeTimer: number
  lostTimer: number
  canSee: boolean
  path: THREE.Vector3[]
  pathTimer: number
  patrolTarget: THREE.Vector3 | null
  patrolWait: number
  burstLeft: number
  shotTimer: number
  strafeDir: number
  strafeTimer: number
  hitFlash: number
  walkPhase: number
  alertSprite: THREE.Sprite
  revealSprite: THREE.Sprite
  alertShow: number
  laser: THREE.Line | null
  flash: THREE.Sprite
  flashTimer: number
}

interface Projectile {
  kind: 'star' | 'frag' | 'rocket'
  mesh: THREE.Object3D
  vel: THREE.Vector3
  life: number
  trailTimer: number
}

interface Pickup {
  weaponId: WeaponId
  mag: number
  reserve: number
  mesh: THREE.Group
  life: number
}

interface HealthPack {
  pos: THREE.Vector3
  mesh: THREE.Group
  cooldown: number
}

interface Effect {
  obj: THREE.Object3D
  life: number
  max: number
  update?: (k: number, obj: THREE.Object3D) => void
  keepGeometry?: boolean
}

interface SkillState {
  def: SkillDef
  cooldown: number
  active: number
  charges: number
}

interface ShotHit {
  point: THREE.Vector3
  normal: THREE.Vector3 | null
  distance: number
  enemy: Enemy | null
  part: 'head' | 'body' | null
}

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

function zoomFov(base: number, zoom: number) {
  return (2 * Math.atan(Math.tan((base * Math.PI) / 360) / zoom) * 180) / Math.PI
}

function randomCone(dir: THREE.Vector3, angle: number) {
  if (angle <= 0) return dir.clone()
  const u = Math.random()
  const v = Math.random()
  const theta = 2 * Math.PI * u
  const r = Math.sqrt(v) * Math.tan(angle)
  const perp1 = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) < 0.99 ? UP : new THREE.Vector3(1, 0, 0)).normalize()
  const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize()
  return dir
    .clone()
    .addScaledVector(perp1, Math.cos(theta) * r)
    .addScaledVector(perp2, Math.sin(theta) * r)
    .normalize()
}

export class Game {
  private container: HTMLElement
  private onHud: (h: HudState) => void
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private vmScene = new THREE.Scene()
  private vmCamera: THREE.PerspectiveCamera
  private vmRoot = new THREE.Group()
  private vmGun: GunModel | null = null
  private vmHand: THREE.Mesh
  private vmFlash: THREE.Sprite
  private muzzleLight: THREE.PointLight
  private explosionLight = new THREE.PointLight(0xff9040, 0, 24, 2)
  private explosionLightTimer = 0
  private world: World
  private arena: ArenaDef
  private difficulty: DifficultyDef
  private pclass: PlayerClassDef
  private sfx = new Sfx()
  private raycaster = new THREE.Raycaster()
  private raf = 0
  private lastFrame = 0
  private resizeObserver: ResizeObserver
  private disposed = false

  // player
  private pos = new THREE.Vector3()
  private vel = new THREE.Vector3()
  private yaw = 0
  private pitch = 0
  private recoilPitch = 0
  private onGround = true
  private health = 100
  private maxHealth = 100
  private lastDamage = -99
  private crouchT = 0
  private bobPhase = 0
  private shake = 0
  private keys = new Set<string>()
  private mouseDown = false
  private rightDown = false
  private firedThisPress = false
  private mouseDX = 0
  private mouseDY = 0
  private locked = false
  private status: GameStatus = 'paused'
  private started = false

  // weapons
  private slots: WeaponSlot[] = []
  private slot = 0
  private fireCooldown = 0
  private reloadTimer = 0
  private switchTimer = 0
  private adsT = 0
  private bloom = 0
  private vmKick = 0
  private swingT = 0
  private flashTimer = 0
  private swaySmooth = new THREE.Vector2()

  // skills
  private skills: SkillState[] = []
  private grapple: { point: THREE.Vector3; t: number; rope: THREE.Line } | null = null
  private speedBoost = 0

  // world entities
  private enemies: Enemy[] = []
  private partsCache: THREE.Object3D[] | null = null
  private projectiles: Projectile[] = []
  private pickups: Pickup[] = []
  private healthPacks: HealthPack[] = []
  private effects: Effect[] = []
  private decals: THREE.Mesh[] = []
  private nextEnemyId = 1

  // waves & stats
  private wave = 0
  private waveState: 'intro' | 'fighting' | 'cleared' = 'intro'
  private waveTimer = 3
  private spawnQueue: EnemyClassId[] = []
  private spawnTimer = 0
  private banner: string | null = null
  private bannerTimer = 0
  private time = 0
  private kills = 0
  private headshots = 0
  private shotsFired = 0
  private shotsHit = 0
  private score = 0
  private hitMarker = 0
  private headshotMarker = 0
  private damageFlash = 0
  private damageIndicators: { angle: number; life: number }[] = []
  private killFeed: (KillFeedEntry & { life: number })[] = []
  private feedId = 1
  private pickupPrompt: string | null = null
  private hudTimer = 0

  // shared resources
  private tracerGeo = new THREE.BoxGeometry(1, 1, 1)
  private decalGeo = new THREE.PlaneGeometry(0.14, 0.14)
  private decalMat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  private puffGeo = new THREE.SphereGeometry(1, 8, 6)

  constructor(container: HTMLElement, config: GameConfig, onHud: (h: HudState) => void) {
    this.container = container
    this.onHud = onHud
    this.arena = ARENAS.find((a) => a.id === config.arenaId) ?? ARENAS[0]
    this.difficulty = DIFFICULTIES.find((d) => d.id === config.difficultyId) ?? DIFFICULTIES[1]
    this.pclass = PLAYER_CLASSES.find((c) => c.id === config.classId) ?? PLAYER_CLASSES[0]

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.autoClear = false
    this.renderer.domElement.style.display = 'block'
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.05, 400)
    this.camera.rotation.order = 'YXZ'
    this.vmCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10)

    this.scene.background = new THREE.Color(this.arena.sky)
    this.scene.fog = new THREE.Fog(this.arena.fog, this.arena.fogNear, this.arena.fogFar)

    this.world = buildWorld(this.arena)
    this.scene.add(this.world.group)
    this.scene.add(this.camera)
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 10, 2)
    this.muzzleLight.position.set(0.2, -0.1, -1)
    this.camera.add(this.muzzleLight)
    this.scene.add(this.explosionLight)

    // viewmodel scene
    this.vmScene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.4))
    const vmSun = new THREE.DirectionalLight(0xffffff, 1.6)
    vmSun.position.set(1, 2, 1)
    this.vmScene.add(vmSun)
    this.vmScene.add(this.vmRoot)
    this.vmHand = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.16),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(this.pclass.accent).multiplyScalar(0.55), roughness: 0.9 }),
    )
    this.vmFlash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    this.vmFlash.scale.setScalar(0.22)
    this.vmFlash.visible = false

    // player setup
    this.maxHealth = this.health = this.pclass.health
    this.pos.copy(this.world.playerSpawn)
    this.yaw = this.faceCenterYaw(this.pos)
    const start = WEAPONS[config.weaponId] ?? WEAPONS[this.pclass.weapons[0]]
    this.slots = [this.makeSlot(start), this.makeSlot(WEAPONS.pistol)]
    this.equipViewmodel()
    this.skills = this.pclass.skills.map((id) => ({ def: SKILLS[id], cooldown: 0, active: 0, charges: SKILLS[id].charges ?? 0 }))

    for (const hp of this.world.healthSpawns) this.healthPacks.push(this.makeHealthPack(hp))

    this.banner = `WAVE 1 — ${this.arena.name.toUpperCase()}`
    this.bannerTimer = 3

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
    this.resize()
    this.bindInput()
    this.lastFrame = performance.now()
    this.loop()
  }

  // ---------------------------------------------------------------- public API

  requestLock() {
    this.sfx.resume()
    if (this.status === 'dead' || this.status === 'victory') return
    const canvas = this.renderer.domElement
    try {
      const res = canvas.requestPointerLock() as unknown as Promise<void> | undefined
      if (res && typeof res.catch === 'function') res.catch(() => {})
    } catch {
      /* browsers may throttle relocking right after Escape */
    }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.unbindInput()
    this.resizeObserver.disconnect()
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock()
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Sprite || o instanceof THREE.Points) {
        o.geometry?.dispose()
        const m = o.material as THREE.Material | THREE.Material[]
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m?.dispose()
      }
    })
    disposeObject(this.vmScene)
    this.world.dispose()
    this.tracerGeo.dispose()
    this.decalGeo.dispose()
    this.decalMat.dispose()
    this.puffGeo.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.sfx.dispose()
  }

  // ---------------------------------------------------------------- setup helpers

  private faceCenterYaw(p: THREE.Vector3) {
    const cx = (this.world.cols * 3) / 2
    const cz = (this.world.rows * 3) / 2
    const dx = cx - p.x
    const dz = cz - p.z
    if (Math.hypot(dx, dz) < 1) return 0
    return Math.atan2(-dx, -dz)
  }

  private makeSlot(def: WeaponDef): WeaponSlot {
    return { def, mag: def.magSize, reserve: def.reserve }
  }

  private get weapon() {
    return this.slots[this.slot]
  }

  private equipViewmodel() {
    if (this.vmGun) {
      this.vmHand.removeFromParent()
      this.vmFlash.removeFromParent()
      this.vmRoot.remove(this.vmGun.group)
      disposeObject(this.vmGun.group)
    }
    const def = this.weapon.def
    this.vmGun = buildGunModel(def.id, def.color)
    this.vmRoot.add(this.vmGun.group)
    this.vmGun.group.add(this.vmHand)
    this.vmHand.position.set(0.0, -0.09, def.melee ? 0.08 : -0.02)
    this.vmGun.muzzle.add(this.vmFlash)
    this.vmFlash.position.set(0, 0, -0.06)
    this.applyInvisibilityLook()
  }

  private resize() {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h, false)
    this.renderer.domElement.style.width = '100%'
    this.renderer.domElement.style.height = '100%'
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.vmCamera.aspect = w / h
    this.vmCamera.updateProjectionMatrix()
  }

  // ---------------------------------------------------------------- input

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.locked) return
    if (['Space', 'Tab', 'KeyQ', 'KeyF', 'KeyG', 'KeyE', 'KeyR'].includes(e.code)) e.preventDefault()
    if (e.repeat) return
    this.keys.add(e.code)
    switch (e.code) {
      case 'KeyR':
        this.startReload()
        break
      case 'Digit1':
        this.switchTo(0)
        break
      case 'Digit2':
        this.switchTo(1)
        break
      case 'KeyE':
        this.tryPickup()
        break
      case 'KeyQ':
      case 'KeyF':
      case 'KeyG':
        this.useSkill(e.code.slice(3) as 'Q' | 'F' | 'G')
        break
      case 'Space':
        if (this.grapple) this.endGrapple(true)
        break
    }
  }
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }
  private onMouseDown = (e: MouseEvent) => {
    if (!this.locked) return
    if (e.button === 0) {
      this.mouseDown = true
      this.firedThisPress = false
    }
    if (e.button === 2) this.rightDown = true
  }
  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false
    if (e.button === 2) this.rightDown = false
  }
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked || this.status !== 'playing') return
    const zoom = 1 + (this.weapon.def.zoom - 1) * this.adsT
    const sens = 0.0022 / zoom
    this.yaw -= e.movementX * sens
    this.pitch -= e.movementY * sens
    this.pitch = Math.max(-1.52, Math.min(1.52, this.pitch))
    this.mouseDX += e.movementX
    this.mouseDY += e.movementY
  }
  private onWheel = (e: WheelEvent) => {
    if (!this.locked) return
    this.switchTo(this.slot === 0 ? 1 : 0)
    e.preventDefault()
  }
  private onContext = (e: Event) => e.preventDefault()
  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.renderer.domElement
    if (this.locked) {
      if (this.status === 'paused') this.status = 'playing'
      if (!this.started) this.time = 0
      this.started = true
      this.lastFrame = performance.now()
    } else {
      this.keys.clear()
      this.mouseDown = this.rightDown = false
      if (this.status === 'playing') this.status = 'paused'
    }
    this.pushHud()
  }
  private onBlur = () => {
    this.keys.clear()
    this.mouseDown = this.rightDown = false
  }

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('blur', this.onBlur)
    window.addEventListener('contextmenu', this.onContext)
    document.addEventListener('pointerlockchange', this.onLockChange)
  }
  private unbindInput() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('blur', this.onBlur)
    window.removeEventListener('contextmenu', this.onContext)
    document.removeEventListener('pointerlockchange', this.onLockChange)
  }

  // ---------------------------------------------------------------- main loop

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000)
    this.lastFrame = now
    if (this.status === 'playing') this.update(dt)
    else if (!this.started) this.idleCamera(dt)
    this.render()
    this.hudTimer -= dt
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.05
      this.pushHud()
    }
  }

  private idleCamera(dt: number) {
    this.time += dt * 0.15
    this.camera.position.copy(this.pos).add(tmpV.set(0, EYE, 0))
    this.camera.rotation.set(-0.05, this.yaw + Math.sin(this.time) * 0.25, 0)
  }

  private render() {
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    this.renderer.clearDepth()
    if (!this.scoped && this.status !== 'dead') this.renderer.render(this.vmScene, this.vmCamera)
  }

  private get timeScale() {
    return this.skills.some((s) => s.def.id === 'focus' && s.active > 0) ? 0.35 : 1
  }
  private get invisible() {
    return this.skills.some((s) => s.def.id === 'invisibility' && s.active > 0)
  }
  private get armored() {
    return this.skills.some((s) => s.def.id === 'armor' && s.active > 0)
  }
  private get pulsing() {
    return this.skills.some((s) => s.def.id === 'pulse' && s.active > 0)
  }
  private get scoped() {
    return !!this.weapon.def.scope && this.adsT > 0.85
  }

  private update(dt: number) {
    this.time += dt
    const wdt = dt * this.timeScale
    this.updatePlayer(dt)
    this.updateWeapon(dt)
    this.updateSkills(dt)
    this.updateEnemies(wdt)
    this.updateProjectiles(wdt)
    this.updatePickups(dt)
    this.updateEffects(dt)
    this.updateWaves(dt)
    updateWeather(this.world, dt)
    this.hitMarker = Math.max(0, this.hitMarker - dt * 5)
    this.headshotMarker = Math.max(0, this.headshotMarker - dt * 2.5)
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2)
    for (const d of this.damageIndicators) d.life -= dt
    this.damageIndicators = this.damageIndicators.filter((d) => d.life > 0)
    for (const k of this.killFeed) k.life -= dt
    this.killFeed = this.killFeed.filter((k) => k.life > 0)
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) this.banner = null
    }
  }

  // ---------------------------------------------------------------- player

  private updatePlayer(dt: number) {
    const k = this.keys
    const crouch = k.has('KeyC')
    this.crouchT += ((crouch ? 1 : 0) - this.crouchT) * Math.min(1, dt * 12)
    const fx = -Math.sin(this.yaw)
    const fz = -Math.cos(this.yaw)
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)
    let wx = 0
    let wz = 0
    const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0)
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    wx = fx * fwd + rx * side
    wz = fz * fwd + rz * side
    const len = Math.hypot(wx, wz)
    if (len > 0) {
      wx /= len
      wz /= len
    }
    const sprinting = k.has('ShiftLeft') && fwd > 0 && !crouch && this.adsT < 0.3
    this.speedBoost = Math.max(0, this.speedBoost - dt)
    let speed = BASE_SPEED * this.pclass.speed
    if (sprinting) speed *= 1.5
    if (crouch) speed *= 0.5
    speed *= 1 - 0.35 * this.adsT
    if (this.speedBoost > 0) speed *= 1.4

    if (this.grapple) {
      const g = this.grapple
      g.t += dt
      const eye = tmpV.copy(this.pos).add(tmpV2.set(0, EYE, 0))
      const dir = g.point.clone().sub(eye)
      const dist = dir.length()
      if (dist < 1.6 || g.t > 1.8) this.endGrapple(false)
      else {
        dir.normalize().multiplyScalar(30)
        this.vel.lerp(dir, Math.min(1, dt * 10))
        const pts = [this.camera.localToWorld(new THREE.Vector3(-0.25, -0.3, -0.5)), g.point]
        g.rope.geometry.setFromPoints(pts)
      }
    } else {
      const control = this.onGround ? 12 : len > 0 ? 2.5 : 0
      const t = 1 - Math.exp(-control * dt)
      this.vel.x += (wx * speed - this.vel.x) * t
      this.vel.z += (wz * speed - this.vel.z) * t
      if (k.has('Space') && this.onGround) {
        this.vel.y = JUMP_SPEED
        this.onGround = false
      }
      this.vel.y -= GRAVITY * dt
    }

    const res = moveBody(this.world.colliders, this.pos, this.vel, dt, PLAYER_RADIUS, PLAYER_HEIGHT)
    this.onGround = res.onGround

    // camera
    const hspeed = Math.hypot(this.vel.x, this.vel.z)
    if (this.onGround && hspeed > 0.5) this.bobPhase += dt * hspeed * 1.6
    const bobAmt = this.onGround ? Math.min(1, hspeed / 6) * (1 - this.adsT * 0.85) : 0
    const eyeH = EYE + (CROUCH_EYE - EYE) * this.crouchT
    this.recoilPitch *= Math.exp(-dt * 9)
    this.shake *= Math.exp(-dt * 8)
    this.camera.position.set(
      this.pos.x + (Math.random() - 0.5) * this.shake,
      this.pos.y + eyeH + Math.abs(Math.sin(this.bobPhase)) * 0.05 * bobAmt + (Math.random() - 0.5) * this.shake,
      this.pos.z,
    )
    this.camera.rotation.set(this.pitch + this.recoilPitch, this.yaw, Math.sin(this.bobPhase * 0.5) * 0.004 * bobAmt)
    this.camera.updateMatrixWorld()

    // regen
    if (this.difficulty.regen && this.time - this.lastDamage > 5 && this.health < this.maxHealth) {
      this.health = Math.min(this.maxHealth, this.health + 10 * dt)
    }
  }

  private damagePlayer(amount: number, from: THREE.Vector3) {
    if (this.status !== 'playing') return
    if (this.armored) amount *= 0.35
    this.health -= amount
    this.lastDamage = this.time
    this.damageFlash = Math.min(1, this.damageFlash + 0.35 + amount / 60)
    this.shake = Math.max(this.shake, Math.min(0.08, amount / 400))
    const dx = from.x - this.pos.x
    const dz = from.z - this.pos.z
    const fwd = dx * -Math.sin(this.yaw) + dz * -Math.cos(this.yaw)
    const right = dx * Math.cos(this.yaw) + dz * -Math.sin(this.yaw)
    this.damageIndicators.push({ angle: Math.atan2(right, fwd), life: 1.2 })
    if (this.damageIndicators.length > 6) this.damageIndicators.shift()
    this.sfx.hurt()
    if (this.health <= 0) {
      this.health = 0
      this.status = 'dead'
      this.endGrapple(false)
      if (document.pointerLockElement) document.exitPointerLock()
      this.pushHud()
    }
  }

  // ---------------------------------------------------------------- weapons

  private switchTo(i: number) {
    if (i === this.slot || !this.slots[i] || this.switchTimer > 0) return
    this.slot = i
    this.reloadTimer = 0
    this.switchTimer = 0.35
    this.adsT = 0
    this.equipViewmodel()
  }

  private startReload() {
    const w = this.weapon
    if (w.def.melee || this.reloadTimer > 0 || w.mag >= w.def.magSize || w.reserve <= 0) return
    this.reloadTimer = w.def.reloadTime
    this.sfx.reload()
  }

  private updateWeapon(dt: number) {
    const w = this.weapon
    const def = w.def
    this.fireCooldown -= dt
    this.switchTimer = Math.max(0, this.switchTimer - dt)
    this.bloom = Math.max(0, this.bloom - dt * 0.25)
    this.vmKick *= Math.exp(-dt * 14)
    this.swingT = Math.max(0, this.swingT - dt * 3)
    this.flashTimer -= dt
    this.vmFlash.visible = this.flashTimer > 0
    this.muzzleLight.intensity = this.flashTimer > 0 ? 18 : 0

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0
        const need = def.magSize - w.mag
        const take = Math.min(need, w.reserve)
        w.mag += take
        w.reserve -= take
      }
    }

    const sprinting = this.keys.has('ShiftLeft') && this.keys.has('KeyW') && Math.hypot(this.vel.x, this.vel.z) > 6.5
    const wantAds = this.rightDown && this.reloadTimer <= 0 && this.switchTimer <= 0 && !this.grapple
    const adsRate = def.scope ? 5 : 8
    this.adsT += ((wantAds ? 1 : 0) - this.adsT) * Math.min(1, dt * adsRate)
    if (Math.abs(this.adsT - (wantAds ? 1 : 0)) < 0.002) this.adsT = wantAds ? 1 : 0
    const zoom = 1 + (def.zoom - 1) * this.adsT
    const fov = zoomFov(BASE_FOV, zoom) + (sprinting ? 4 : 0)
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 20)
      this.camera.updateProjectionMatrix()
    }

    if (this.mouseDown && this.fireCooldown <= 0 && this.reloadTimer <= 0 && this.switchTimer <= 0 && !sprinting) {
      if (def.auto || !this.firedThisPress) {
        this.firedThisPress = true
        this.fire()
      }
    }
    if (!def.melee && w.mag === 0 && w.reserve > 0 && this.reloadTimer <= 0 && this.fireCooldown <= 0) this.startReload()

    // viewmodel pose
    if (!this.vmGun) return
    const g = this.vmGun.group
    const hip = def.melee ? new THREE.Vector3(0.26, -0.28, -0.42) : new THREE.Vector3(0.19, -0.2, -0.42)
    const ads = def.melee ? new THREE.Vector3(0.18, -0.24, -0.4) : new THREE.Vector3(0, -this.vmGun.sightHeight, -0.3)
    const p = hip.lerp(ads, this.adsT)
    const hspeed = Math.hypot(this.vel.x, this.vel.z)
    const bob = this.onGround ? Math.min(1, hspeed / 6) * (1 - this.adsT * 0.9) : 0
    this.swaySmooth.x += (this.mouseDX * 0.0006 - this.swaySmooth.x) * Math.min(1, dt * 10)
    this.swaySmooth.y += (this.mouseDY * 0.0006 - this.swaySmooth.y) * Math.min(1, dt * 10)
    this.mouseDX = this.mouseDY = 0
    const sway = 1 - this.adsT * 0.8
    p.x += Math.sin(this.bobPhase) * 0.012 * bob - this.swaySmooth.x * sway
    p.y += -Math.abs(Math.cos(this.bobPhase)) * 0.012 * bob + this.swaySmooth.y * sway
    p.z += this.vmKick * 0.035
    let rx = this.vmKick * 0.05
    let ry = 0
    let rz = 0
    if (def.melee) {
      rx += -0.5
      ry += 0.3
      rz += 0.25
      if (this.swingT > 0) {
        const s = Math.sin((1 - this.swingT) * Math.PI)
        ry += -s * 1.6
        rx += s * 0.9
        rz += -s * 0.8
        p.x -= s * 0.22
      }
    }
    if (this.reloadTimer > 0) {
      const t = 1 - this.reloadTimer / def.reloadTime
      const s = Math.sin(t * Math.PI)
      rx -= s * 0.55
      rz += s * 0.35
      p.y -= s * 0.08
    }
    if (this.switchTimer > 0) p.y -= (this.switchTimer / 0.35) * 0.3
    if (sprinting && !def.melee) {
      ry += 0.5
      rx -= 0.15
      p.x -= 0.04
    }
    g.position.copy(p)
    g.rotation.set(rx, ry, rz)
  }

  private enemyParts() {
    if (!this.partsCache) this.partsCache = this.enemies.filter((e) => !e.dead).flatMap((e) => e.model.hitParts)
    return this.partsCache
  }

  private findEnemyForPart(obj: THREE.Object3D): Enemy | null {
    let o: THREE.Object3D | null = obj
    while (o) {
      if (o.userData.enemyId) return this.enemies.find((e) => e.id === o!.userData.enemyId) ?? null
      o = o.parent
    }
    return null
  }

  private castShot(origin: THREE.Vector3, dir: THREE.Vector3, range: number, includeEnemies = true): ShotHit | null {
    this.raycaster.set(origin, dir)
    this.raycaster.far = range
    const targets = includeEnemies ? [...this.world.solids, ...this.enemyParts()] : this.world.solids
    const hits = this.raycaster.intersectObjects(targets, false)
    const h = hits[0]
    if (!h) return null
    const part = (h.object.userData.part as 'head' | 'body' | undefined) ?? null
    const enemy = part ? this.findEnemyForPart(h.object) : null
    const normal = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : null
    return { point: h.point.clone(), normal, distance: h.distance, enemy, part }
  }

  private muzzleWorld() {
    const local = new THREE.Vector3(0.19 * (1 - this.adsT), -0.14 * (1 - this.adsT) - 0.05 * this.adsT, -0.8)
    return this.camera.localToWorld(local)
  }

  private fire() {
    const w = this.weapon
    const def = w.def
    const origin = this.camera.getWorldPosition(new THREE.Vector3())
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    this.fireCooldown = 1 / def.fireRate

    if (def.melee) {
      this.swingT = 1
      this.sfx.shot('katana')
      let best: ShotHit | null = null
      for (const yo of [0, -0.25, 0.25, -0.45, 0.45]) {
        for (const po of [0, -0.15, 0.12]) {
          const d = forward.clone().applyAxisAngle(UP, yo)
          d.y += po
          d.normalize()
          const hit = this.castShot(origin, d, def.range)
          if (hit?.enemy && (!best || (hit.part === 'head' && best.part !== 'head'))) best = hit
        }
        if (best?.part === 'head') break
      }
      this.shotsFired++
      if (best?.enemy) {
        this.shotsHit++
        this.spawnBlood(best.point)
        this.damageEnemy(best.enemy, def.damage, best.part ?? 'body', 'melee')
      }
      return
    }

    if (w.mag <= 0) {
      this.sfx.click()
      this.startReload()
      return
    }
    w.mag--
    this.shotsFired++
    this.flashTimer = 0.05
    this.vmFlash.material.rotation = Math.random() * Math.PI
    this.sfx.shot(def.id)
    this.recoilPitch += def.recoil * 0.012 * (1 - 0.45 * this.adsT)
    this.pitch += def.recoil * 0.004 * (1 - 0.3 * this.adsT)
    this.yaw += (Math.random() - 0.5) * def.recoil * 0.004
    this.vmKick += def.recoil * (1 - 0.5 * this.adsT)
    if (def.noise > 0) this.makeNoise(def.noise)

    const moving = Math.hypot(this.vel.x, this.vel.z) > 1.5
    const spread =
      (def.spread + (def.adsSpread - def.spread) * this.adsT) * (moving ? 1.5 : 1) * (this.onGround ? 1 : 2) * (1 - 0.3 * this.crouchT) + this.bloom
    this.bloom = Math.min(0.05, this.bloom + def.recoil * 0.004)
    const muzzle = this.muzzleWorld()
    let anyHit = false
    for (let i = 0; i < def.pellets; i++) {
      const dir = randomCone(forward, spread)
      const hit = this.castShot(origin, dir, def.range)
      const end = hit ? hit.point : origin.clone().addScaledVector(dir, def.range)
      if (i < 4) this.spawnTracer(muzzle, end, 0xffd38a)
      if (!hit) continue
      if (hit.enemy) {
        anyHit = true
        const falloff = def.pellets > 1 ? Math.max(0.25, 1 - hit.distance / def.range) : 1
        this.spawnBlood(hit.point)
        this.damageEnemy(hit.enemy, def.damage * falloff, hit.part ?? 'body', 'bullet')
      } else {
        this.spawnImpact(hit.point, hit.normal)
      }
    }
    if (anyHit) this.shotsHit++
  }

  private makeNoise(radius: number) {
    for (const e of this.enemies) {
      if (e.dead) continue
      const d = e.pos.distanceTo(this.pos)
      if (d < radius || (d < radius * 1.6 && hasLineOfSight(this.world, e.pos, this.pos))) {
        if (e.state !== 'alert') this.alertEnemy(e, this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)))
      }
    }
  }

  // ---------------------------------------------------------------- pickups

  private tryPickup() {
    const p = this.nearestPickup()
    if (!p) return
    const old = this.weapon
    this.slots[this.slot] = { def: WEAPONS[p.weaponId], mag: p.mag, reserve: p.reserve }
    this.removePickup(p)
    this.spawnPickup(old.def.id, this.pos.clone(), old.mag, old.reserve)
    this.reloadTimer = 0
    this.switchTimer = 0.35
    this.equipViewmodel()
    this.sfx.pickup()
    this.feed(`Picked up ${WEAPONS[p.weaponId].name}`, false)
  }

  private nearestPickup(): Pickup | null {
    let best: Pickup | null = null
    let bd = 2.2
    for (const p of this.pickups) {
      const d = Math.hypot(p.mesh.position.x - this.pos.x, p.mesh.position.z - this.pos.z)
      if (d < bd && Math.abs(p.mesh.position.y - 0.6 - this.pos.y) < 2) {
        bd = d
        best = p
      }
    }
    return best
  }

  private spawnPickup(weaponId: WeaponId, at: THREE.Vector3, mag: number, reserve: number) {
    const def = WEAPONS[weaponId]
    const group = new THREE.Group()
    const gun = buildGunModel(weaponId, def.color)
    gun.group.scale.setScalar(1.6)
    gun.group.position.z = def.melee ? 0.7 : 0.4
    group.add(gun.group)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0xffc14d, transparent: true, opacity: 0.6, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    ring.rotation.x = -Math.PI / 2
    ring.position.y = -0.55
    group.add(ring)
    group.position.set(at.x, at.y + 0.6, at.z)
    this.scene.add(group)
    this.pickups.push({ weaponId, mag, reserve, mesh: group, life: 45 })
    if (this.pickups.length > 14) this.removePickup(this.pickups[0])
  }

  private removePickup(p: Pickup) {
    this.scene.remove(p.mesh)
    disposeObject(p.mesh)
    this.pickups = this.pickups.filter((x) => x !== p)
  }

  private makeHealthPack(at: THREE.Vector3): HealthPack {
    const group = new THREE.Group()
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.6), new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.4 }))
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.12), crossMat)
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.4), crossMat)
    const glow = new THREE.PointLight(0x4ade80, 6, 5, 2)
    glow.position.y = 0.6
    group.add(box, c1, c2, glow)
    group.position.set(at.x, 0.7, at.z)
    this.scene.add(group)
    return { pos: at.clone(), mesh: group, cooldown: 0 }
  }

  private updatePickups(dt: number) {
    for (const p of [...this.pickups]) {
      p.life -= dt
      p.mesh.rotation.y += dt * 1.5
      p.mesh.position.y = 0.6 + Math.sin(this.time * 2.5 + p.mesh.position.x) * 0.08
      if (p.life <= 0) {
        this.removePickup(p)
        continue
      }
      // walking over a weapon you already carry tops up its ammo
      const d = Math.hypot(p.mesh.position.x - this.pos.x, p.mesh.position.z - this.pos.z)
      if (d < 1.5 && this.pos.y < 1.5) {
        const owned = this.slots.find((s) => s.def.id === p.weaponId)
        if (owned && !owned.def.melee && owned.reserve < owned.def.reserve * 2) {
          owned.reserve = Math.min(owned.def.reserve * 2, owned.reserve + p.mag + p.reserve)
          this.removePickup(p)
          this.sfx.pickup()
          this.feed(`+Ammo ${owned.def.name}`, false)
        }
      }
    }
    const near = this.nearestPickup()
    this.pickupPrompt = near && !this.slots.some((s) => s.def.id === near.weaponId) ? `Press E to swap for ${WEAPONS[near.weaponId].name}` : null

    for (const h of this.healthPacks) {
      if (h.cooldown > 0) {
        h.cooldown -= dt
        h.mesh.visible = h.cooldown <= 0
        continue
      }
      h.mesh.rotation.y += dt
      h.mesh.position.y = 0.7 + Math.sin(this.time * 2) * 0.1
      if (this.health < this.maxHealth && Math.hypot(h.pos.x - this.pos.x, h.pos.z - this.pos.z) < 1.4 && this.pos.y < 1.5) {
        this.health = Math.min(this.maxHealth, this.health + 50)
        h.cooldown = 20
        h.mesh.visible = false
        this.sfx.pickup()
        this.feed('+50 Health', false)
      }
    }
  }

  // ---------------------------------------------------------------- skills

  private useSkill(key: 'Q' | 'F' | 'G') {
    const s = this.skills.find((x) => x.def.key === key)
    if (!s || this.status !== 'playing') return
    if (s.def.charges) {
      if (s.charges <= 0) return
    } else if (s.cooldown > 0 || s.active > 0) return

    const origin = this.camera.getWorldPosition(new THREE.Vector3())
    const forward = this.camera.getWorldDirection(new THREE.Vector3())
    switch (s.def.id) {
      case 'grapple': {
        const hit = this.castShot(origin, forward, 45, false)
        if (!hit || hit.distance < 2.5) {
          this.feed('No anchor point in range', false)
          return
        }
        const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([origin, hit.point]), new THREE.LineBasicMaterial({ color: 0xd6d3d1 }))
        rope.frustumCulled = false
        this.scene.add(rope)
        this.grapple = { point: hit.point, t: 0, rope }
        this.vel.y = Math.max(this.vel.y, 3)
        this.onGround = false
        this.sfx.grapple()
        s.cooldown = s.def.cooldown
        return
      }
      case 'invisibility':
        s.active = s.def.duration ?? 6
        for (const e of this.enemies) e.canSee = false
        this.applyInvisibilityLook(true)
        break
      case 'stars': {
        s.charges--
        if (s.cooldown <= 0) s.cooldown = s.def.cooldown
        const shape = new THREE.Shape()
        for (let i = 0; i < 8; i++) {
          const r = i % 2 === 0 ? 0.16 : 0.05
          const a = (i / 8) * Math.PI * 2
          if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        const mesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 1, roughness: 0.2, side: THREE.DoubleSide }),
        )
        mesh.rotation.x = -Math.PI / 2
        const holder = new THREE.Group()
        holder.add(mesh)
        holder.position.copy(origin).addScaledVector(forward, 0.6).add(new THREE.Vector3(0, -0.1, 0))
        this.scene.add(holder)
        this.projectiles.push({ kind: 'star', mesh: holder, vel: forward.clone().multiplyScalar(48), life: 3, trailTimer: 0 })
        this.sfx.shot('star')
        this.shotsFired++
        return
      }
      case 'frag': {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f4d2a, roughness: 0.6 }))
        mesh.position.copy(origin).addScaledVector(forward, 0.6)
        this.scene.add(mesh)
        const vel = forward.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4, 0)).add(this.vel.clone().multiplyScalar(0.5))
        this.projectiles.push({ kind: 'frag', mesh, vel, life: 1.8, trailTimer: 0 })
        break
      }
      case 'rocket': {
        const group = new THREE.Group()
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0x4b5320 }))
        body.rotation.x = Math.PI / 2
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
        glow.scale.setScalar(0.5)
        glow.position.z = 0.35
        group.add(body, glow)
        group.position.copy(origin).addScaledVector(forward, 0.8).add(new THREE.Vector3(0, -0.15, 0))
        group.lookAt(group.position.clone().sub(forward))
        this.scene.add(group)
        this.projectiles.push({ kind: 'rocket', mesh: group, vel: forward.clone().multiplyScalar(38), life: 4, trailTimer: 0 })
        this.sfx.shot('shotgun', 0.7)
        this.makeNoise(20)
        break
      }
      case 'adrenaline':
        s.active = s.def.duration ?? 5
        this.speedBoost = s.active
        this.health = Math.min(this.maxHealth, this.health + 40)
        break
      case 'armor':
      case 'pulse':
      case 'focus':
        s.active = s.def.duration ?? 5
        break
    }
    if (!s.def.charges) s.cooldown = s.def.cooldown
    this.sfx.skill()
  }

  private endGrapple(jumped: boolean) {
    if (!this.grapple) return
    this.scene.remove(this.grapple.rope)
    this.grapple.rope.geometry.dispose()
    ;(this.grapple.rope.material as THREE.Material).dispose()
    this.grapple = null
    if (jumped) this.vel.y = Math.max(this.vel.y, JUMP_SPEED)
    else this.vel.multiplyScalar(0.6)
  }

  private applyInvisibilityLook(force?: boolean) {
    const inv = force ?? this.invisible
    this.vmGun?.group.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const m = o.material as THREE.Material
        if (m.userData.baseOpacity === undefined) {
          m.userData.baseOpacity = m.opacity
          m.userData.baseTransparent = m.transparent
        }
        m.transparent = inv || m.userData.baseTransparent
        m.opacity = inv ? 0.22 : m.userData.baseOpacity
        m.needsUpdate = true
      }
    })
  }

  private updateSkills(dt: number) {
    for (const s of this.skills) {
      const wasActive = s.active > 0
      if (s.active > 0) s.active = Math.max(0, s.active - dt)
      if (s.def.charges) {
        if (s.charges < s.def.charges) {
          s.cooldown -= dt
          if (s.cooldown <= 0) {
            s.charges++
            s.cooldown = s.charges < s.def.charges ? s.def.cooldown : 0
          }
        } else s.cooldown = 0
      } else if (s.active <= 0 && s.cooldown > 0) s.cooldown = Math.max(0, s.cooldown - dt)
      if (wasActive && s.active <= 0 && s.def.id === 'invisibility') this.applyInvisibilityLook(false)
    }
    const pulse = this.pulsing
    for (const e of this.enemies) e.revealSprite.visible = pulse && !e.dead
  }

  // ---------------------------------------------------------------- projectiles & explosions

  private updateProjectiles(dt: number) {
    for (const p of [...this.projectiles]) {
      p.life -= dt
      const from = p.mesh.position.clone()
      if (p.kind === 'star') {
        p.vel.y -= 3 * dt
        p.mesh.rotation.y += dt * 30
      } else if (p.kind === 'frag') {
        p.vel.y -= 20 * dt
      } else {
        p.trailTimer -= dt
        if (p.trailTimer <= 0) {
          p.trailTimer = 0.02
          this.spawnPuff(p.mesh.position.clone(), 0x9ca3af, 0.15, 0.6, 0.5)
        }
      }

      if (p.kind === 'frag') {
        this.bounceFrag(p, dt)
        if (p.life <= 0) {
          this.explode(p.mesh.position.clone(), 7, 170)
          this.removeProjectile(p)
        }
        continue
      }

      const step = p.vel.clone().multiplyScalar(dt)
      const len = step.length()
      const hit = this.castShot(from, step.clone().normalize(), len + 0.05)
      if (hit) {
        if (p.kind === 'rocket') {
          this.explode(hit.point.clone().addScaledVector(step.normalize(), -0.3), 6, 200)
          this.removeProjectile(p)
          continue
        }
        if (hit.enemy) {
          this.shotsHit++
          this.spawnBlood(hit.point)
          this.damageEnemy(hit.enemy, 78, hit.part ?? 'body', 'star')
          this.removeProjectile(p)
        } else {
          // stick in the wall for a moment
          p.mesh.position.copy(hit.point)
          this.projectiles = this.projectiles.filter((x) => x !== p)
          this.addEffect(p.mesh, 4)
        }
        continue
      }
      p.mesh.position.add(step)
      if (p.life <= 0) {
        if (p.kind === 'rocket') this.explode(p.mesh.position.clone(), 6, 200)
        this.removeProjectile(p)
      }
    }
  }

  private bounceFrag(p: Projectile, dt: number) {
    const pos = p.mesh.position
    const r = 0.12
    const inside = () => this.world.colliders.some((c) => pos.x > c.min.x - r && pos.x < c.max.x + r && pos.z > c.min.z - r && pos.z < c.max.z + r && pos.y > c.min.y - r && pos.y < c.max.y + r)
    for (const axis of ['x', 'z', 'y'] as const) {
      const prev = pos[axis]
      pos[axis] += p.vel[axis] * dt
      if (inside()) {
        pos[axis] = prev
        p.vel[axis] *= -0.4
        if (axis === 'y') {
          p.vel.x *= 0.7
          p.vel.z *= 0.7
        }
      }
    }
    if (pos.y < r) {
      pos.y = r
      p.vel.y = Math.abs(p.vel.y) * 0.35
      p.vel.x *= 0.7
      p.vel.z *= 0.7
    }
  }

  private removeProjectile(p: Projectile) {
    this.scene.remove(p.mesh)
    disposeObject(p.mesh)
    this.projectiles = this.projectiles.filter((x) => x !== p)
  }

  private explode(at: THREE.Vector3, radius: number, damage: number) {
    this.sfx.explosion(Math.max(0.3, 1 - at.distanceTo(this.pos) / 60))
    const fire = new THREE.Mesh(this.puffGeo, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }))
    fire.position.copy(at)
    this.scene.add(fire)
    this.addEffect(fire, 0.5, (k, o) => {
      o.scale.setScalar(0.5 + (1 - k) * radius * 0.6)
      ;((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = k
    }, true)
    // one pooled light: adding/removing lights forces every material to recompile
    this.explosionLight.position.copy(at)
    this.explosionLight.distance = radius * 4
    this.explosionLightTimer = 0.35
    for (let i = 0; i < 6; i++) {
      this.spawnPuff(at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2)), 0x3f3f46, 0.6, 1.6, 2.5)
    }
    for (const e of this.enemies) {
      if (e.dead) continue
      const d = e.pos.clone().setY(at.y).distanceTo(at)
      if (d < radius && hasLineOfSight(this.world, at, e.pos)) this.damageEnemy(e, damage * Math.pow(1 - d / radius, 0.6), 'body', 'explosion')
    }
    const pd = this.pos.clone().add(new THREE.Vector3(0, 1, 0)).distanceTo(at)
    if (pd < radius && hasLineOfSight(this.world, at, this.pos)) this.damagePlayer(damage * 0.3 * (1 - pd / radius), at)
    this.shake = Math.max(this.shake, 0.25 * Math.max(0, 1 - pd / 25))
  }

  // ---------------------------------------------------------------- effects

  private addEffect(obj: THREE.Object3D, life: number, update?: Effect['update'], keepGeometry = false) {
    if (!obj.parent) this.scene.add(obj)
    this.effects.push({ obj, life, max: life, update, keepGeometry })
  }

  private updateEffects(dt: number) {
    this.explosionLightTimer = Math.max(0, this.explosionLightTimer - dt)
    this.explosionLight.intensity = (this.explosionLightTimer / 0.35) * 60
    for (const fx of this.effects) {
      fx.life -= dt
      fx.update?.(Math.max(0, fx.life / fx.max), fx.obj)
    }
    const dead = this.effects.filter((f) => f.life <= 0)
    if (!dead.length) return
    for (const f of dead) {
      this.scene.remove(f.obj)
      if (f.keepGeometry) {
        f.obj.traverse((o) => {
          if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose()
        })
      } else if (!(f.obj instanceof THREE.Light)) disposeObject(f.obj)
    }
    this.effects = this.effects.filter((f) => f.life > 0)
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, color: number) {
    const len = from.distanceTo(to)
    if (len < 0.5) return
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    const mesh = new THREE.Mesh(this.tracerGeo, mat)
    mesh.position.copy(from).lerp(to, 0.5)
    mesh.lookAt(to)
    mesh.scale.set(0.025, 0.025, len)
    this.addEffect(mesh, 0.07, (k, o) => (((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.85 * k), true)
  }

  private spawnPuff(at: THREE.Vector3, color: number, size: number, life: number, grow: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false })
    const mesh = new THREE.Mesh(this.puffGeo, mat)
    mesh.position.copy(at)
    mesh.scale.setScalar(size)
    this.addEffect(mesh, life, (k, o) => {
      o.scale.setScalar(size + (1 - k) * grow)
      ;((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 * k
      o.position.y += 0.005
    }, true)
  }

  private spawnImpact(at: THREE.Vector3, normal: THREE.Vector3 | null) {
    this.spawnPuff(at, 0xd6d3d1, 0.05, 0.35, 0.25)
    if (!normal) return
    const decal = new THREE.Mesh(this.decalGeo, this.decalMat)
    decal.position.copy(at).addScaledVector(normal, 0.01)
    decal.lookAt(at.clone().add(normal))
    this.scene.add(decal)
    this.decals.push(decal)
    if (this.decals.length > 80) this.scene.remove(this.decals.shift()!)
  }

  private spawnBlood(at: THREE.Vector3) {
    this.spawnPuff(at, 0xb91c1c, 0.08, 0.4, 0.35)
  }

  private feed(text: string, headshot: boolean) {
    this.killFeed.push({ id: this.feedId++, text, headshot, life: 4 })
    if (this.killFeed.length > 5) this.killFeed.shift()
  }

  // ---------------------------------------------------------------- enemies

  private spawnEnemy(classId: EnemyClassId, at: THREE.Vector3, alerted: boolean) {
    const def = ENEMY_CLASSES[classId]
    const wdef = WEAPONS[def.weapon]
    const model = buildEnemyModel(def.color, def.weapon, wdef.color, def.scale)
    const id = this.nextEnemyId++
    model.group.userData.enemyId = id
    model.group.rotation.order = 'YXZ'
    model.group.position.copy(at)
    this.scene.add(model.group)

    const alertSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: alertTexture(), depthTest: false, transparent: true }))
    alertSprite.scale.setScalar(0.6)
    alertSprite.position.y = 2.35
    alertSprite.visible = false
    alertSprite.renderOrder = 10
    model.group.add(alertSprite)
    const revealSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture(), depthTest: false, transparent: true }))
    revealSprite.scale.setScalar(0.7)
    revealSprite.position.y = 1.2
    revealSprite.visible = false
    revealSprite.renderOrder = 11
    model.group.add(revealSprite)
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    flash.scale.setScalar(0.5)
    flash.visible = false
    model.muzzle.add(flash)

    let laser: THREE.Line | null = null
    if (classId === 'marksman') {
      laser = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]),
        new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0, depthWrite: false }),
      )
      laser.frustumCulled = false
      this.scene.add(laser)
    }

    const hp = def.health * this.difficulty.enemyHealth
    const e: Enemy = {
      id, def, model, pos: model.group.position, vel: new THREE.Vector3(), yaw: this.faceCenterYaw(at), hp, maxHp: hp,
      state: 'patrol', dead: false, deadTimer: 0, lastKnown: this.pos.clone(), seeTimer: 0, lostTimer: 0, canSee: false,
      path: [], pathTimer: 0, patrolTarget: null, patrolWait: Math.random() * 2, burstLeft: def.burst, shotTimer: 0.5,
      strafeDir: Math.random() > 0.5 ? 1 : -1, strafeTimer: 1, hitFlash: 0, walkPhase: Math.random() * 6, alertSprite,
      revealSprite, alertShow: 0, laser, flash, flashTimer: 0,
    }
    if (alerted) {
      e.state = 'search'
      e.lastKnown = this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 10, 0, (Math.random() - 0.5) * 10))
    }
    this.enemies.push(e)
    this.partsCache = null
    this.spawnPuff(at.clone().add(new THREE.Vector3(0, 1, 0)), 0x94a3b8, 0.5, 0.8, 1.5)
  }

  private alertEnemy(e: Enemy, at: THREE.Vector3) {
    if (e.dead) return
    if (e.state !== 'alert') {
      e.alertShow = 1.2
      e.alertSprite.visible = true
    }
    e.state = 'alert'
    e.lastKnown.copy(at)
    e.lostTimer = 0
    e.pathTimer = 0
  }

  private alertNearby(src: Enemy) {
    for (const o of this.enemies) {
      if (o === src || o.dead || o.state === 'alert') continue
      if (o.pos.distanceTo(src.pos) < 16) this.alertEnemy(o, src.lastKnown)
    }
  }

  private damageEnemy(e: Enemy, amount: number, part: 'head' | 'body', source: 'bullet' | 'melee' | 'star' | 'explosion') {
    if (e.dead) return
    const headshot = part === 'head' && source !== 'explosion'
    if (headshot) amount = Infinity
    e.hp -= amount
    e.hitFlash = 0.12
    this.hitMarker = 1
    if (headshot) {
      this.headshotMarker = 1
      this.sfx.headshot()
    } else this.sfx.hit()
    // getting shot reveals the player's position and makes the enemy turn and react fast
    this.alertEnemy(e, this.pos)
    e.seeTimer = Math.max(e.seeTimer, this.difficulty.reaction * 0.6)
    this.alertNearby(e)
    if (e.hp <= 0) this.killEnemy(e, headshot, source)
  }

  private killEnemy(e: Enemy, headshot: boolean, source: string) {
    e.dead = true
    e.deadTimer = 0
    e.alertSprite.visible = false
    e.revealSprite.visible = false
    if (e.laser) e.laser.visible = false
    this.partsCache = null
    this.kills++
    if (headshot) this.headshots++
    const pts = (100 + (headshot ? 50 : 0) + (source === 'melee' || source === 'star' ? 25 : 0)) * this.difficulty.scoreMult
    this.score += Math.round(pts)
    this.sfx.kill()
    const how = headshot ? 'HEADSHOT' : source === 'melee' ? 'Blade kill' : source === 'star' ? 'Shuriken kill' : source === 'explosion' ? 'Blasted' : 'Eliminated'
    this.feed(`${how} — ${e.def.name} +${Math.round(pts)}`, headshot)
    const wdef = WEAPONS[e.def.weapon]
    this.spawnPickup(e.def.weapon, e.pos.clone(), wdef.magSize, Math.round(wdef.magSize * 1.5))
    if (headshot) {
      const head = e.model.hitParts.filter((p) => p.userData.part === 'head')
      head.forEach((h) => (h.visible = false))
      this.spawnPuff(e.pos.clone().add(new THREE.Vector3(0, e.model.headHeight, 0)), 0x991b1b, 0.15, 0.6, 0.6)
    }
  }

  private enemyEye(e: Enemy, out = new THREE.Vector3()) {
    return out.set(e.pos.x, e.pos.y + e.model.headHeight, e.pos.z)
  }

  private updateEnemies(dt: number) {
    const playerEye = this.camera.position.clone()
    const playerChest = this.pos.clone().add(new THREE.Vector3(0, 1.2 - 0.4 * this.crouchT, 0))
    const invisible = this.invisible
    const removals: Enemy[] = []

    for (const e of this.enemies) {
      if (e.dead) {
        e.deadTimer += dt
        const fall = Math.min(1, e.deadTimer / 0.45)
        e.model.group.rotation.x = fall * fall * 1.45
        e.model.legs.forEach((l) => (l.rotation.x = 0))
        if (e.deadTimer > 5) e.model.group.position.y -= dt * 0.5
        if (e.deadTimer > 7) removals.push(e)
        continue
      }

      // --- perception ---
      const toPlayer = tmpV.copy(this.pos).sub(e.pos)
      const dist = Math.hypot(toPlayer.x, toPlayer.z)
      const eye = this.enemyEye(e)
      let canSee = false
      if (!invisible && this.status === 'playing') {
        const viewRange = e.def.viewRange * (0.85 + 0.15 * this.difficulty.accuracy)
        if (dist < viewRange) {
          const fx = -Math.sin(e.yaw)
          const fz = -Math.cos(e.yaw)
          const facing = (toPlayer.x * fx + toPlayer.z * fz) / Math.max(dist, 0.001)
          const inCone = e.state === 'alert' || facing > 0.45 || dist < 3
          if (inCone && hasLineOfSight(this.world, eye, playerEye)) canSee = true
        }
        // hear sprinting footsteps
        if (!canSee && dist < 6 && Math.hypot(this.vel.x, this.vel.z) > 8 && this.onGround) {
          this.alertEnemy(e, this.pos)
        }
      }
      e.canSee = canSee
      if (canSee) {
        if (e.state !== 'alert') {
          this.alertEnemy(e, this.pos)
          this.alertNearby(e)
        }
        e.lastKnown.copy(this.pos)
        e.seeTimer += dt
        e.lostTimer = 0
      } else {
        e.seeTimer = Math.max(0, e.seeTimer - dt * 1.5)
        if (e.state === 'alert') {
          e.lostTimer += dt
          if (e.lostTimer > 1.5) e.state = 'search'
        } else if (e.state === 'search') {
          e.lostTimer += dt
          if (e.lostTimer > 12) e.state = 'patrol'
        }
      }

      // --- movement intent ---
      const speed = e.def.speed
      let target: THREE.Vector3 | null = null
      let moveSpeed = speed
      let faceTarget: THREE.Vector3 | null = null
      if (e.state === 'alert' && canSee) {
        faceTarget = this.pos
        const pref = e.def.preferredRange
        if (dist > pref * 1.2) target = this.pos
        else if (dist < pref * 0.55) {
          const away = e.pos.clone().sub(this.pos).setY(0).normalize().multiplyScalar(3).add(e.pos)
          if (canWalkStraight(this.world, e.pos, away, ENEMY_RADIUS)) target = away
          moveSpeed = speed * 0.7
        }
        if (!target) {
          e.strafeTimer -= dt
          if (e.strafeTimer <= 0) {
            e.strafeDir *= -1
            e.strafeTimer = 1 + Math.random() * 1.5
          }
          const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize().multiplyScalar(e.strafeDir * 2.5)
          const st = e.pos.clone().add(side)
          if (canWalkStraight(this.world, e.pos, st, ENEMY_RADIUS)) target = st
          else e.strafeDir *= -1
          moveSpeed = speed * 0.55
        }
      } else if (e.state === 'alert' || e.state === 'search') {
        target = e.lastKnown
        moveSpeed = e.state === 'alert' ? speed : speed * 0.75
        if (e.pos.distanceTo(e.lastKnown) < 1.5) {
          // arrived — look around and pick a nearby spot to search
          const p = e.lastKnown.clone().add(new THREE.Vector3((Math.random() - 0.5) * 12, 0, (Math.random() - 0.5) * 12))
          if (canWalkStraight(this.world, e.pos, p, ENEMY_RADIUS)) e.lastKnown.copy(p)
        }
      } else {
        // patrol
        if (!e.patrolTarget || e.pos.distanceTo(e.patrolTarget) < 1.2) {
          e.patrolWait -= dt
          if (e.patrolWait <= 0) {
            e.patrolTarget = randomWalkablePoint(this.world)
            e.patrolWait = 1 + Math.random() * 2.5
            e.path = []
          }
        } else target = e.patrolTarget
        moveSpeed = speed * 0.45
      }

      // --- path following ---
      const desired = new THREE.Vector3()
      if (target) {
        let waypoint: THREE.Vector3 | null = null
        if (canWalkStraight(this.world, e.pos, target, ENEMY_RADIUS)) {
          waypoint = target
          e.path = []
        } else {
          e.pathTimer -= dt
          if (e.pathTimer <= 0 || e.path.length === 0) {
            e.path = findPath(this.world, e.pos, target)
            e.pathTimer = 0.7 + Math.random() * 0.3
          }
          while (e.path.length > 1 && Math.hypot(e.path[0].x - e.pos.x, e.path[0].z - e.pos.z) < 0.6) e.path.shift()
          // skip ahead to the furthest directly-reachable waypoint
          if (e.path.length > 1 && canWalkStraight(this.world, e.pos, e.path[1], ENEMY_RADIUS)) e.path.shift()
          waypoint = e.path[0] ?? null
        }
        if (waypoint) {
          desired.set(waypoint.x - e.pos.x, 0, waypoint.z - e.pos.z)
          const dl = desired.length()
          if (dl > 0.2) desired.multiplyScalar(moveSpeed / dl)
          else desired.set(0, 0, 0)
        }
      }
      // separation from other enemies
      for (const o of this.enemies) {
        if (o === e || o.dead) continue
        const dx = e.pos.x - o.pos.x
        const dz = e.pos.z - o.pos.z
        const d2 = dx * dx + dz * dz
        if (d2 < 1.2 && d2 > 0.0001) {
          const d = Math.sqrt(d2)
          desired.x += (dx / d) * 2
          desired.z += (dz / d) * 2
        }
      }
      if (!faceTarget && desired.lengthSq() > 0.1) faceTarget = e.pos.clone().add(desired)
      e.vel.x += (desired.x - e.vel.x) * Math.min(1, dt * 8)
      e.vel.z += (desired.z - e.vel.z) * Math.min(1, dt * 8)
      e.vel.y -= GRAVITY * dt
      moveBody(this.world.colliders, e.pos, e.vel, dt, ENEMY_RADIUS, 1.8 * e.def.scale, 0.2)

      if (faceTarget) {
        const want = Math.atan2(-(faceTarget.x - e.pos.x), -(faceTarget.z - e.pos.z))
        let diff = want - e.yaw
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        e.yaw += diff * Math.min(1, dt * (canSee ? 10 : 5))
      }
      e.model.group.rotation.y = e.yaw
      // aim torso pitch toward player
      if (canSee) {
        const pitch = Math.atan2(playerChest.y - (e.pos.y + 1.35 * e.def.scale), Math.max(dist, 0.1))
        e.model.torso.rotation.x = pitch
      } else e.model.torso.rotation.x *= 0.9

      const hs = Math.hypot(e.vel.x, e.vel.z)
      e.walkPhase += dt * hs * 2.2
      const swing = Math.sin(e.walkPhase) * Math.min(0.7, hs * 0.15)
      e.model.legs[0].rotation.x = swing
      e.model.legs[1].rotation.x = -swing

      // visual timers
      if (e.hitFlash > 0) {
        e.hitFlash -= dt
        e.model.materials[0].emissive.setHex(e.hitFlash > 0 ? 0xff4040 : 0x000000)
      }
      if (e.alertShow > 0) {
        e.alertShow -= dt
        e.alertSprite.visible = e.alertShow > 0
      }
      e.flashTimer -= dt
      e.flash.visible = e.flashTimer > 0

      // --- shooting ---
      const aimTime = this.difficulty.reaction + (e.def.id === 'marksman' ? 0.9 : 0)
      if (e.laser) {
        const lm = e.laser.material as THREE.LineBasicMaterial
        if (canSee && e.seeTimer > 0.05) {
          const m = e.model.muzzle.getWorldPosition(new THREE.Vector3())
          e.laser.geometry.setFromPoints([m, playerChest])
          lm.opacity = Math.min(0.9, 0.2 + (e.seeTimer / aimTime) * 0.7)
          e.laser.visible = true
        } else e.laser.visible = false
      }
      if (canSee && e.seeTimer >= aimTime && this.status === 'playing') {
        e.shotTimer -= dt
        if (e.shotTimer <= 0) {
          if (e.burstLeft > 0) {
            this.enemyFire(e, dist, playerChest)
            e.burstLeft--
            e.shotTimer = e.def.shotInterval
          } else {
            e.burstLeft = e.def.burst
            e.shotTimer = e.def.burstPause * (0.75 + Math.random() * 0.5)
            if (e.def.id === 'marksman') e.seeTimer = 0.05 // re-aim between shots
          }
        }
      }
    }

    for (const e of removals) {
      this.scene.remove(e.model.group)
      disposeObject(e.model.group)
      if (e.laser) {
        this.scene.remove(e.laser)
        disposeObject(e.laser)
      }
    }
    if (removals.length) this.enemies = this.enemies.filter((e) => !removals.includes(e))
  }

  private enemyFire(e: Enemy, dist: number, target: THREE.Vector3) {
    const muzzle = e.model.muzzle.getWorldPosition(new THREE.Vector3())
    e.flashTimer = 0.06
    const wdef = WEAPONS[e.def.weapon]
    this.sfx.shot(wdef.id, Math.max(0.08, 0.8 - dist / 70))

    const playerSpeed = Math.hypot(this.vel.x, this.vel.z)
    let chance = e.def.accuracy * this.difficulty.accuracy
    chance *= Math.max(0.25, 1.15 - dist / (e.def.viewRange * 1.1))
    if (playerSpeed > 7) chance *= 0.65
    else if (playerSpeed > 3) chance *= 0.85
    if (!this.onGround) chance *= 0.7
    if (this.grapple) chance *= 0.35
    if (this.crouchT > 0.5) chance *= 0.85
    if (e.def.id === 'breacher' && dist > 12) chance *= 0.3
    chance = Math.min(0.95, chance)

    // is there cover (including low crates) between the shooter and the player?
    const dir = target.clone().sub(muzzle)
    const len = dir.length()
    dir.normalize()
    const block = this.castShot(muzzle, dir, len - 0.3, false)
    if (block) {
      this.spawnTracer(muzzle, block.point, 0xff8a5c)
      this.spawnImpact(block.point, block.normal)
      return
    }
    if (Math.random() < chance) {
      this.spawnTracer(muzzle, target.clone().add(new THREE.Vector3(0, -0.2, 0)), 0xff8a5c)
      this.damagePlayer(e.def.damage * this.difficulty.enemyDamage, e.pos)
    } else {
      const miss = target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.5, (Math.random() - 0.3) * 1.5, (Math.random() - 0.5) * 2.5))
      const mdir = miss.sub(muzzle).normalize()
      const hit = this.castShot(muzzle, mdir, 80, false)
      const end = hit ? hit.point : muzzle.clone().addScaledVector(mdir, 80)
      this.spawnTracer(muzzle, end, 0xff8a5c)
      if (hit) this.spawnImpact(hit.point, hit.normal)
    }
  }

  // ---------------------------------------------------------------- waves

  private get aliveCount() {
    return this.enemies.filter((e) => !e.dead).length
  }

  private updateWaves(dt: number) {
    const waves = this.arena.waves
    if (this.waveState === 'intro' || this.waveState === 'cleared') {
      this.waveTimer -= dt
      if (this.waveTimer <= 0) {
        const list = waves[this.wave]
        const count = Math.max(2, Math.round(list.length * this.difficulty.countMult))
        this.spawnQueue = Array.from({ length: count }, (_, i) => list[i % list.length])
        this.spawnTimer = 0
        this.waveState = 'fighting'
      }
      return
    }
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 0.6
        const spawns = [...this.world.enemySpawns].sort((a, b) => b.distanceTo(this.pos) - a.distanceTo(this.pos))
        const pool = spawns.slice(0, Math.max(1, Math.ceil(spawns.length * 0.6)))
        const at = pool[Math.floor(Math.random() * pool.length)].clone()
        const cls = this.spawnQueue.shift()!
        this.spawnEnemy(cls, at, this.wave >= 2 || (this.wave === 1 && Math.random() < 0.5))
      }
      return
    }
    if (this.aliveCount === 0) {
      const bonus = Math.round(250 * (this.wave + 1) * this.difficulty.scoreMult)
      this.score += bonus
      if (this.wave >= waves.length - 1) {
        this.status = 'victory'
        this.banner = null
        if (document.pointerLockElement) document.exitPointerLock()
        this.pushHud()
        return
      }
      this.wave++
      this.waveState = 'cleared'
      this.waveTimer = 5
      this.banner = `WAVE ${this.wave} CLEARED  +${bonus}  —  WAVE ${this.wave + 1} INCOMING`
      this.bannerTimer = 4.5
      // restock some ammo between waves
      for (const s of this.slots) if (!s.def.melee) s.reserve = Math.max(s.reserve, Math.round(s.def.reserve * 0.6))
    }
  }

  // ---------------------------------------------------------------- HUD

  private pushHud() {
    const w = this.weapon
    const def = w.def
    const zoomed = 1 + (def.zoom - 1) * this.adsT
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1.5
    const spread = (def.spread + (def.adsSpread - def.spread) * this.adsT) * (moving ? 1.5 : 1) * (this.onGround ? 1 : 2) + this.bloom
    this.onHud({
      status: this.status,
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      weaponName: def.name,
      weaponId: def.id,
      slot: this.slot,
      slots: this.slots.map((s) => ({ id: s.def.id, name: s.def.name })),
      mag: w.mag,
      reserve: w.reserve,
      melee: !!def.melee,
      reloading: this.reloadTimer > 0,
      reloadProgress: this.reloadTimer > 0 ? 1 - this.reloadTimer / def.reloadTime : 0,
      ads: this.adsT,
      scoped: this.scoped,
      spread: spread * zoomed,
      skills: this.skills.map((s) => ({
        id: s.def.id,
        name: s.def.name,
        key: s.def.key,
        ready: s.def.charges ? (s.charges >= s.def.charges ? 1 : 1 - s.cooldown / s.def.cooldown) : s.cooldown > 0 ? 1 - s.cooldown / s.def.cooldown : 1,
        active: s.active > 0 || (s.def.id === 'grapple' && !!this.grapple),
        charges: s.def.charges ? s.charges : undefined,
        maxCharges: s.def.charges,
      })),
      wave: this.wave + 1,
      totalWaves: this.arena.waves.length,
      enemiesLeft: this.aliveCount + this.spawnQueue.length,
      waveBanner: this.banner,
      kills: this.kills,
      headshots: this.headshots,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      score: this.score,
      time: this.started ? this.time : 0,
      hitMarker: this.hitMarker,
      headshotMarker: this.headshotMarker,
      damageFlash: this.damageFlash,
      damageAngles: this.damageIndicators.map((d) => d.angle),
      pickupPrompt: this.pickupPrompt,
      killFeed: this.killFeed.map(({ id, text, headshot }) => ({ id, text, headshot })),
      invisible: this.invisible,
      armored: this.armored,
      focused: this.timeScale < 1,
      grappling: !!this.grapple,
      pulsing: this.pulsing,
      pointerLocked: this.locked,
    })
  }
}
