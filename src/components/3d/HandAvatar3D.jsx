// HandAvatar3D.jsx — Real GLB rigged hands
//
// ANIMATION PHILOSOPHY:
//   This is an FPS first-person rig. The forearm bones are the PRIMARY
//   control point. Animating upper-arm + deltoid together with large values
//   causes compounding that breaks the mesh into impossible shapes.
//   RULE: Only animate forearmR + forearmL. Keep values small (max ±12°).
//   The wrist (palmRotate) handles palm-facing. Fingers handle the gesture.

import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getPoseForGesture } from '../../data/avatarPoses.js'

const DEG = Math.PI / 180
const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky']

// Confirmed names from useGLTF.nodes log (Three.js strips dots)
const BONE_MAP_R = {
  thumb: ['thumb01R_023', 'thumb02R_024', 'thumb03R_025'],
  index: ['f_index01R_027', 'f_index02R_028', 'f_index03R_029'],
  middle: ['f_middle01R_016', 'f_middle02R_017', 'f_middle03R_018'],
  ring: ['f_ring01R_020', 'f_ring02R_021', 'f_ring03R_022'],
  pinky: ['f_pinky01R_012', 'f_pinky02R_013', 'f_pinky03R_014'],
  wrist: 'handR_010',
}
const BONE_MAP_L = {
  thumb: ['thumb01L_048', 'thumb02L_049', 'thumb03L_050'],
  index: ['f_index01L_037', 'f_index02L_038', 'f_index03L_039'],
  middle: ['f_middle01L_045', 'f_middle02L_046', 'f_middle03L_047'],
  ring: ['f_ring01L_041', 'f_ring02L_042', 'f_ring03L_043'],
  pinky: ['f_pinky01L_033', 'f_pinky02L_034', 'f_pinky03L_035'],
  wrist: 'handL_031',
}

// Only the two forearm bones — the ONLY safe bones to drive for this FPS rig
const FOREARM_R = 'forearmR001_09'
const FOREARM_L = 'forearmL001_030'

useGLTF.preload('/models/first_person_hands_rigged.glb')

// Module-scope scratch — zero GC per frame
const _q1 = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _aX = new THREE.Vector3(1, 0, 0)
const _aZ = new THREE.Vector3(0, 0, 1)

function resolveBones(nodes, boneMap) {
  const out = { fingers: {}, wrist: null, restQ: {} }
  for (const f of FINGER_NAMES) {
    out.fingers[f] = boneMap[f].map(n => nodes[n] ?? null)
    out.restQ[f] = boneMap[f].map(n => nodes[n]?.quaternion.clone() ?? new THREE.Quaternion())
  }
  const w = nodes[boneMap.wrist] ?? null
  out.wrist = w
  out.restQ.wrist = w?.quaternion.clone() ?? new THREE.Quaternion()
  return out
}

function applyFingerPose(bones, target, curr, lf, chirality) {
  for (const finger of FINGER_NAMES) {
    const boneList = bones.fingers[finger]
    const restList = bones.restQ[finger]
    const tgtAngles = target[finger] ?? [0, 0, 0]
    for (let i = 0; i < 3; i++) {
      curr[finger][i] = THREE.MathUtils.lerp(curr[finger][i], tgtAngles[i] ?? 0, lf)
      const bone = boneList[i], rest = restList[i]
      if (!bone || !rest) continue
      _q1.setFromAxisAngle(_aX, curr[finger][i] * DEG)
      if (finger === 'thumb' && i === 0) {
        _q2.setFromAxisAngle(_aZ, curr[finger][i] * DEG * 0.28 * chirality)
        _q1.multiply(_q2)
      }
      bone.quaternion.multiplyQuaternions(rest, _q1)
    }
  }
  curr.palmRotate = THREE.MathUtils.lerp(curr.palmRotate, target.palmRotate ?? 0, lf)
  if (bones.wrist && bones.restQ.wrist) {
    _q1.setFromAxisAngle(_aZ, curr.palmRotate * DEG * chirality)
    bones.wrist.quaternion.multiplyQuaternions(bones.restQ.wrist, _q1)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export default function HandAvatar3D({ gesture = 'idle', isActive = false, speed = 1 }) {
  const { scene, nodes } = useGLTF('/models/first_person_hands_rigged.glb')

  const groupRef = useRef()
  const bonesR = useRef(null)
  const bonesL = useRef(null)
  const clock = useRef(0)

  // Forearm bone refs + their rest quaternions
  const fArmR = useRef(null)
  const fArmL = useRef(null)
  const fArmRestR = useRef(null)
  const fArmRestL = useRef(null)

  // Lerped arm state — slow 2 Hz movement for weighty feel
  const armR = useRef({ lift: 0, roll: 0 })
  const armL = useRef({ lift: 0, roll: 0 })

  // Lerped root-group position — moves whole arm (elbow+hand) to sign-specific location
  const groupPos = useRef({ x: 0.1, y: -0.65, z: 0 })

  const currR = useRef({ thumb: [0, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 })
  const currL = useRef({ thumb: [0, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0], palmRotate: 0 })

  const targetRef = useRef(getPoseForGesture(gesture))
  const lastGestRef = useRef(gesture)
  useEffect(() => {
    targetRef.current = getPoseForGesture(gesture)
    lastGestRef.current = gesture
  }, [gesture])

  useEffect(() => {
    if (!nodes || !scene) return

    scene.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = obj.receiveShadow = true
        if (obj.isSkinnedMesh) obj.frustumCulled = false
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach(m => { if (m) { m.roughness = 0.42; m.metalness = 0.05; m.needsUpdate = true } })
      }
    })

    bonesR.current = resolveBones(nodes, BONE_MAP_R)
    bonesL.current = resolveBones(nodes, BONE_MAP_L)

    fArmR.current = nodes[FOREARM_R] ?? null
    fArmL.current = nodes[FOREARM_L] ?? null
    fArmRestR.current = fArmR.current?.quaternion.clone() ?? null
    fArmRestL.current = fArmL.current?.quaternion.clone() ?? null

    if (import.meta.env.DEV) {
      const missing = [...Object.values(BONE_MAP_R).flat(), ...Object.values(BONE_MAP_L).flat()]
        .filter(n => !nodes[n])
      if (missing.length) console.warn('[HandAvatar3D] Missing:', missing)
      else console.info('[HandAvatar3D] ✓ All bones ready. Forearms:', !!fArmR.current, !!fArmL.current)
    }
  }, [nodes, scene])

  useFrame((_, delta) => {
    if (!bonesR.current || !bonesL.current) return

    const dt = delta * speed
    clock.current += dt
    const t = clock.current

    // Finger lerp — fast (5 Hz)
    const lf = 1 - Math.pow(0.02, dt * 5)
    applyFingerPose(bonesR.current, targetRef.current, currR.current, lf, 1)
    applyFingerPose(bonesL.current, targetRef.current, currL.current, lf, -1)

    // ── ROOT GROUP POSITION — moves entire arm including elbow ─────────────
    // This is the CORRECT way to move the elbow in 3D space.
    // Bone rotations only bend joints; translating the root moves everything.
    const tp = targetRef.current.pos ?? { x: 0, y: 0, z: 0 }
    const plf = 1 - Math.pow(0.02, dt * 2.2)  // ~2.2 Hz — weighty arm movement
    // Base X is 0.1 (shifted slightly right)
    groupPos.current.x = THREE.MathUtils.lerp(groupPos.current.x, 0.1 + (tp.x ?? 0), plf)
    // Base Y is -0.65 + per-gesture offset
    groupPos.current.y = THREE.MathUtils.lerp(groupPos.current.y, -0.65 + (tp.y ?? 0), plf)
    groupPos.current.z = THREE.MathUtils.lerp(groupPos.current.z, tp.z ?? 0, plf)

    // Tiny idle breathing on top
    const breathY = Math.sin(t * 0.48) * 0.007

    if (groupRef.current) {
      groupRef.current.position.x = groupPos.current.x
      groupRef.current.position.y = groupPos.current.y + breathY
      groupRef.current.position.z = groupPos.current.z
    }

    // ── FOREARM ROTATION — controls elbow ANGLE ──────────────────────────
    // lift = degrees of X-axis rotation on forearm bone.
    // forearm bone ORIGIN = elbow joint. Rotating it pivots the hand around the elbow.
    // -50° lift = arm raised near face (eat/drink). -35° = raised wave (hello). 0° = rest.
    const ta = targetRef.current.arm ?? { lift: 0, roll: 0 }
    const alf = 1 - Math.pow(0.02, dt * 3)   // 3 Hz — visible, weighty arm movement
    armR.current.lift = THREE.MathUtils.lerp(armR.current.lift, ta.lift ?? 0, alf)
    armR.current.roll = THREE.MathUtils.lerp(armR.current.roll, ta.roll ?? 0, alf)
    armL.current.lift = THREE.MathUtils.lerp(armL.current.lift, ta.lift ?? 0, alf)
    armL.current.roll = THREE.MathUtils.lerp(armL.current.roll, -(ta.roll ?? 0), alf)

    const idleX = Math.sin(t * 0.5) * 0.025   // ±1.4° idle sway
    const idleZ = Math.sin(t * 0.35) * 0.018  // ±1.0° idle roll

    if (fArmR.current && fArmRestR.current) {
      _q1.setFromAxisAngle(_aX, armR.current.lift * DEG + idleX)
      _q2.setFromAxisAngle(_aZ, armR.current.roll * DEG + idleZ)
      _q1.multiply(_q2)
      fArmR.current.quaternion.multiplyQuaternions(fArmRestR.current, _q1)
    }
    if (fArmL.current && fArmRestL.current) {
      _q1.setFromAxisAngle(_aX, armL.current.lift * DEG + idleX)
      _q2.setFromAxisAngle(_aZ, armL.current.roll * DEG - idleZ)
      _q1.multiply(_q2)
      fArmL.current.quaternion.multiplyQuaternions(fArmRestL.current, _q1)
    }
  })

  if (!scene) return null

  return (
    <group
      ref={groupRef}
      position={[0.1, -0.65, 0]}
      scale={0.022}
      rotation={[0, Math.PI - 0.2, 0]}
    >
      <primitive object={scene} />
    </group>
  )
}
