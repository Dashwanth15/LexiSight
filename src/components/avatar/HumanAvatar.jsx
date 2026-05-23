// HumanAvatar.jsx — Full-Chain AI-Driven 3D Sign-Language Interpreter
//
// ARCHITECTURE:
//   Prediction → GestureDebouncer → armChain pose → full bone chain animation
//
//   Bone hierarchy driven per frame:
//     clavicle → deltoid → upper_arm → forearm → forearmExt → hand → fingers
//
// KEY SYSTEMS:
//   1. Full arm-chain animation (not just wrist)
//   2. Prediction debounce + cooldown via GestureDebouncer
//   3. Exponential spring-lerp for frame-rate independent smooth transitions
//   4. Procedural breathing + idle micro-sways
//   5. Custom shaders: arm-clip on body mesh + suit-sleeve on hand rig

import { useRef, useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { getPoseForGesture, calculateMirrorPose, getIdleState } from './AnimationManager.js'
import { interpolatePose, blendPoseWithIdle } from './AvatarController.js'
import { GestureDebouncer } from './GestureAnimator.js'

// ── Constants ─────────────────────────────────────────────────────────────────
const DEG = Math.PI / 180
const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky']

// ── Full arm chain bone names (from first_person_hands_rigged.glb) ─────────────
// Right arm: clavicle → deltoid → upper_arm → forearm → forearmExt → hand → fingers
const ARM_CHAIN_R = {
  clavicle  : 'clavicle.R_01',
  deltoid   : 'deltoid.R_02',
  upperArm  : 'upper_arm.R_03',
  forearm   : 'forearm.R_04',
  forearmExt: 'forearm.R.001_09',
}
const ARM_CHAIN_L = {
  clavicle  : 'clavicle.L_05',
  deltoid   : 'deltoid.L_06',
  upperArm  : 'upper_arm.L_07',
  forearm   : 'forearm.L_08',
  forearmExt: 'forearm.L.001_030',
}

// ── Finger bone maps ─────────────────────────────────────────────────────────
const BONE_MAP_R = {
  thumb : ['thumb.01.R_023', 'thumb.02.R_024', 'thumb.03.R_025'],
  index : ['f_index.01.R_027', 'f_index.02.R_028', 'f_index.03.R_029'],
  middle: ['f_middle.01.R_016', 'f_middle.02.R_017', 'f_middle.03.R_018'],
  ring  : ['f_ring.01.R_020', 'f_ring.02.R_021', 'f_ring.03.R_022'],
  pinky : ['f_pinky.01.R_012', 'f_pinky.02.R_013', 'f_pinky.03.R_014'],
  wrist : 'hand.R_010',
}
const BONE_MAP_L = {
  thumb : ['thumb.01.L_048', 'thumb.02.L_049', 'thumb.03.L_050'],
  index : ['f_index.01.L_037', 'f_index.02.L_038', 'f_index.03.L_039'],
  middle: ['f_middle.01.L_045', 'f_middle.02.L_046', 'f_middle.03.L_047'],
  ring  : ['f_ring.01.L_041', 'f_ring.02.L_042', 'f_ring.03.L_043'],
  pinky : ['f_pinky.01.L_033', 'f_pinky.02.L_034', 'f_pinky.03.L_035'],
  wrist : 'hand.L_031',
}

// ── Preload ───────────────────────────────────────────────────────────────────
useGLTF.preload('/models/human.glb')
useGLTF.preload('/models/first_person_hands_rigged.glb')

// ── Module-level scratch variables (avoid GC pressure in the render loop) ────
const _q1  = new THREE.Quaternion()
const _q2  = new THREE.Quaternion()
const _aX  = new THREE.Vector3(1, 0, 0)
const _aY  = new THREE.Vector3(0, 1, 0)
const _aZ  = new THREE.Vector3(0, 0, 1)
const _eu  = new THREE.Euler()
const _tmpQ = new THREE.Quaternion()

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve all finger bones + wrist from a useGLTF nodes object */
function resolveRigBones(nodes, boneMap) {
  const out = { fingers: {}, wrist: null, restQ: {} }
  for (const f of FINGER_NAMES) {
    out.fingers[f] = boneMap[f].map(n => nodes[n] ?? null)
    out.restQ[f]   = boneMap[f].map(n => nodes[n]?.quaternion.clone() ?? new THREE.Quaternion())
  }
  const w = nodes[boneMap.wrist] ?? null
  out.wrist       = w
  out.restQ.wrist = w?.quaternion.clone() ?? new THREE.Quaternion()
  return out
}

/** Resolve the full arm chain + store rest quaternions */
function resolveArmChain(nodes, chainMap) {
  const bones  = {}
  const restQs = {}
  for (const [key, name] of Object.entries(chainMap)) {
    const b = nodes[name] ?? null
    bones[key]  = b
    restQs[key] = b?.quaternion.clone() ?? new THREE.Quaternion()
  }
  return { bones, restQs }
}

/** Apply finger + wrist skeletal pose from currState angles */
function applyFingerPose(boneSet, currState, lf, chirality) {
  for (const finger of FINGER_NAMES) {
    const boneList = boneSet.fingers[finger]
    const restList = boneSet.restQ[finger]
    const angles   = currState[finger] ?? [0, 0, 0]

    for (let i = 0; i < 3; i++) {
      const bone = boneList[i]
      const rest = restList[i]
      if (!bone || !rest) continue

      _q1.setFromAxisAngle(_aX, angles[i] * DEG)
      if (finger === 'thumb' && i === 0) {
        _q2.setFromAxisAngle(_aZ, angles[i] * DEG * 0.28 * chirality)
        _q1.multiply(_q2)
      }
      bone.quaternion.multiplyQuaternions(rest, _q1)
    }
  }

  // Wrist palm rotation
  if (boneSet.wrist && boneSet.restQ.wrist) {
    _q1.setFromAxisAngle(_aZ, currState.palmRotate * DEG * chirality)
    boneSet.wrist.quaternion.multiplyQuaternions(boneSet.restQ.wrist, _q1)
  }
}

/**
 * Apply the full arm chain for one side.
 * armData  = current smooth arm chain angles (lerped each frame)
 * armChain = { bones, restQs } resolved on load
 * lf       = lerp factor
 * side     = 'R' | 'L'  — mirrors Y and Z for the left arm
 */
function applyArmChain(armData, armChain, lf, side) {
  const mirror = side === 'L' ? -1 : 1

  // deltoid — main shoulder lift (Z lifts right arm up; mirrored flips sign)
  _applyBoneRotation(
    armChain.bones.deltoid,
    armChain.restQs.deltoid,
    armData.deltoidX * DEG,
    armData.deltoidY * DEG * mirror,
    armData.deltoidZ * DEG * mirror,
    lf
  )

  // upper arm — elbow position / arm swing
  _applyBoneRotation(
    armChain.bones.upperArm,
    armChain.restQs.upperArm,
    armData.upperArmX * DEG,
    armData.upperArmY * DEG * mirror,
    armData.upperArmZ * DEG * mirror,
    lf
  )

  // forearm — elbow bend
  _applyBoneRotation(
    armChain.bones.forearm,
    armChain.restQs.forearm,
    armData.forearmX * DEG,
    armData.forearmY * DEG * mirror,
    armData.forearmZ * DEG * mirror,
    lf
  )

  // forearmExt — wrist connection / roll
  _applyBoneRotation(
    armChain.bones.forearmExt,
    armChain.restQs.forearmExt,
    0,
    0,
    (armData.forearmExtZ ?? 0) * DEG * mirror,
    lf
  )
}

/** Internal: compose XYZ Euler on top of rest quaternion and slerp bone toward it */
function _applyBoneRotation(bone, restQ, rx, ry, rz, lf) {
  if (!bone || !restQ) return
  _eu.set(rx, ry, rz, 'XYZ')
  _tmpQ.setFromEuler(_eu)
  _q1.multiplyQuaternions(restQ, _tmpQ)
  bone.quaternion.slerp(_q1, lf)
}

// ── Default zero armChain state (for smooth lerping) ─────────────────────────
function makeArmChainState() {
  return {
    deltoidX: 0, deltoidY: 0, deltoidZ: 0,
    upperArmX: 0, upperArmY: 0, upperArmZ: 0,
    forearmX: 0, forearmY: 0, forearmZ: 0,
    forearmExtZ: 0,
  }
}

/** Lerp one armChain state toward another */
function lerpArmChain(curr, target, lf) {
  for (const key of Object.keys(curr)) {
    const tgt = target?.[key] ?? 0
    curr[key] = THREE.MathUtils.lerp(curr[key], tgt, lf)
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HumanAvatar({
  gesture    = 'idle',
  isActive   = false,
  speed      = 1.0,
  mirrorMode = false,
  rawLandmarks = null,
  livePrediction = null,   // { label, confidence } from ML — fed to debouncer
}) {
  // ── Assets ─────────────────────────────────────────────────────────────────
  const bodyGltf  = useGLTF('/models/human.glb')
  const handsGltf = useGLTF('/models/first_person_hands_rigged.glb')

  const bodyScene  = bodyGltf.scene
  const handsScene = handsGltf.scene
  const handsNodes = handsGltf.nodes

  // ── Refs ───────────────────────────────────────────────────────────────────
  const groupRef     = useRef()
  const bodyGroupRef = useRef()
  const handsGroupRef = useRef()

  // Finger bones
  const bonesR = useRef(null)
  const bonesL = useRef(null)

  // Full arm chains
  const armChainR = useRef(null)   // { bones, restQs }
  const armChainL = useRef(null)

  // Scale computed from body bounding box
  const [bodyScale, setBodyScale]   = useState(1.0)
  const [bodyOffset, setBodyOffset] = useState({ x: 0, y: 0, z: 0 })

  // Track the raw unscaled bounding box center of bodyScene
  const bodyCenterRef = useRef({ x: 0, y: 0, z: 0 })

  // Gesture debouncer (for live ML mode)
  const debouncer = useRef(new GestureDebouncer({ stabilityFrames: 4, minConfidence: 0.58, cooldownMs: 380 }))

  // Smooth pose state (lerped each frame)
  const currPose = useRef({
    thumb: [0, 0, 0], index: [0, 0, 0], middle: [0, 0, 0], ring: [0, 0, 0], pinky: [0, 0, 0],
    palmRotate: 0,
    arm: { lift: 0, roll: 0 },
    pos: { x: 0, y: 0, z: 0 },
    bodyRotateX: 0,
    bodyRotateY: 0,
  })

  // Current smooth arm chain state (separately lerped for R and L)
  const currArmR = useRef(makeArmChainState())
  const currArmL = useRef(makeArmChainState())

  // ── Body model setup ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!bodyScene) return

    bodyScene.traverse(obj => {
      if (!obj.isMesh) return
      obj.castShadow    = true
      obj.receiveShadow = true

      // Detect arm-wide meshes that contain static baked arms
      // Use geometry bounding box for scale-independent detection
      if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox()
      const geomSize = obj.geometry.boundingBox.getSize(new THREE.Vector3())
      const hasArms   = geomSize.x > 2.0

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach(m => {
        if (!m) return
        m.roughness = 0.5
        m.metalness = 0.15

        // Shader arm-clip: discard pixels that are part of the static baked arms
        if (hasArms) {
          const isSuit = obj.name.toLowerCase().includes('suit') ||
                         obj.name.includes('Object_20') || obj.name.includes('Object_8')
          const yCutoff = isSuit ? 1.92 : 2.95

          m.onBeforeCompile = shader => {
            shader.vertexShader = `
              varying vec3 vLocalPos;
              ${shader.vertexShader}
            `.replace(
              '#include <begin_vertex>',
              `#include <begin_vertex>
               vLocalPos = position.xyz;`
            )
            shader.fragmentShader = `
              varying vec3 vLocalPos;
              ${shader.fragmentShader}
            `.replace(
              '#include <dithering_fragment>',
              `#include <dithering_fragment>
               if (abs(vLocalPos.x) > 1.35 && vLocalPos.y < ${yCutoff.toFixed(2)}) discard;`
            )
          }
        }
        m.needsUpdate = true
      })
    })

    // Auto-scale and center body
    const box    = new THREE.Box3().setFromObject(bodyScene)
    const size   = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Save raw center to ref for hand positioning
    bodyCenterRef.current = { x: center.x, y: center.y, z: center.z }

    const sc = 1.28 / size.y
    setBodyScale(sc)
    setBodyOffset({
      x: -center.x * sc,
      y: -center.y * sc - 0.28,
      z: -center.z * sc - 0.1,
    })
  }, [bodyScene])

  // ── Hand rig + arm chain setup ─────────────────────────────────────────────
  useEffect(() => {
    if (!handsNodes || !handsScene) return

    handsScene.traverse(obj => {
      if (!obj.isMesh) return
      obj.castShadow    = true
      obj.receiveShadow = true
      if (obj.isSkinnedMesh) obj.frustumCulled = false

      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      mats.forEach(m => {
        if (!m) return
        m.roughness = 0.35
        m.metalness = 0.25

        // Suit-sleeve shader: colour upper forearm area to match the suit jacket
        m.onBeforeCompile = shader => {
          shader.vertexShader = `
            varying vec3 vLocalPos;
            ${shader.vertexShader}
          `.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vLocalPos = position.xyz;`
          )
          shader.fragmentShader = `
            varying vec3 vLocalPos;
            ${shader.fragmentShader}
          `.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             if (vLocalPos.y > 0.712) {
               gl_FragColor.rgb = vec3(0.015, 0.027, 0.047);
             }`
          )
        }
        m.needsUpdate = true
      })
    })

    // Resolve finger bones
    bonesR.current = resolveRigBones(handsNodes, BONE_MAP_R)
    bonesL.current = resolveRigBones(handsNodes, BONE_MAP_L)

    // Resolve full arm chains
    armChainR.current = resolveArmChain(handsNodes, ARM_CHAIN_R)
    armChainL.current = resolveArmChain(handsNodes, ARM_CHAIN_L)

  }, [handsNodes, handsScene])

  // ── Main render loop ──────────────────────────────────────────────────────
  useFrame((state, delta) => {
    // Wait until bones are resolved
    if (!bonesR.current || !bonesL.current) return
    if (!armChainR.current || !armChainL.current) return

    const dt   = Math.min(0.1, delta * speed)
    const time = state.clock.getElapsedTime()

    // 1. Idle breathing / micro-sway (intensity reduced while actively signing)
    const idleWeight = (isActive || mirrorMode) ? 0.35 : 1.0
    const idle = getIdleState(time, idleWeight)

    // 2. Determine target gesture ─────────────────────────────────────────────
    let targetGesture = gesture

    if (mirrorMode && rawLandmarks) {
      // Direct MediaPipe mirror — bypass debounce
      const mirrorPose = calculateMirrorPose(rawLandmarks)
      if (mirrorPose) {
        // In mirror mode animate fingers/wrist directly; keep arm in signing position
        const lf    = 1 - Math.pow(0.01, dt * 5.0)
        const armLf = 1 - Math.pow(0.01, dt * 3.5)

        interpolatePose(currPose.current, { ...mirrorPose, armChain: { ...currArmR.current } }, lf, armLf, armLf)
        blendPoseWithIdle(currPose.current, idle)

        applyFingerPose(bonesR.current, currPose.current, lf, 1)
        applyFingerPose(bonesL.current, currPose.current, lf, -1)

        // Keep arms in a neutral signing position during mirror mode
        const signingArm = {
          deltoidX: 0, deltoidY: -18, deltoidZ: -52,
          upperArmX: 0, upperArmY: 0, upperArmZ: -22,
          forearmX: 25, forearmY: 0, forearmZ: 0, forearmExtZ: 0,
        }
        lerpArmChain(currArmR.current, signingArm, armLf)
        lerpArmChain(currArmL.current, signingArm, armLf)
        applyArmChain(currArmR.current, armChainR.current, 1, 'R')
        applyArmChain(currArmL.current, armChainL.current, 1, 'L')

        _applyBodySway(bodyGroupRef, bodyOffset, bodyScale, idle, currPose.current.bodyRotateX, currPose.current.bodyRotateY)
        return
      }
    }

    // Live AI prediction → run through debouncer for stability
    if (livePrediction?.label && !mirrorMode) {
      targetGesture = debouncer.current.update(livePrediction.label, livePrediction.confidence)
    }

    // 3. Get target pose from library ─────────────────────────────────────────
    const target = getPoseForGesture(targetGesture)

    // 4. Lerp factors ─────────────────────────────────────────────────────────
    const lf    = 1 - Math.pow(0.01, dt * 5.0)    // fingers  (~5 Hz spring)
    const armLf = 1 - Math.pow(0.01, dt * 2.5)    // arm chain (~2.5 Hz spring)
    const posLf = 1 - Math.pow(0.01, dt * 2.0)    // body root (~2 Hz spring)

    // 5. Interpolate pose state ───────────────────────────────────────────────
    interpolatePose(currPose.current, target, lf, armLf, posLf)
    blendPoseWithIdle(currPose.current, idle)

    // 6. Apply finger poses ───────────────────────────────────────────────────
    applyFingerPose(bonesR.current, currPose.current, lf, 1)
    applyFingerPose(bonesL.current, currPose.current, lf, -1)

    // 7. Lerp and apply full arm chains ───────────────────────────────────────
    const targetArmChain = target?.armChain ?? {}
    lerpArmChain(currArmR.current, targetArmChain, armLf)
    lerpArmChain(currArmL.current, targetArmChain, armLf)  // same pose, mirroring handled inside

    applyArmChain(currArmR.current, armChainR.current, 1, 'R')
    applyArmChain(currArmL.current, armChainL.current, 1, 'L')

    // 8. Hand group position (in body local space) ────────────────────────────
    if (handsGroupRef.current) {
      const bCenter = bodyCenterRef.current
      handsGroupRef.current.position.x = bCenter.x + currPose.current.pos.x / Math.max(0.01, bodyScale)
      handsGroupRef.current.position.y = 2.72 + currPose.current.pos.y / Math.max(0.01, bodyScale)
      handsGroupRef.current.position.z = bCenter.z + 0.15 + currPose.current.pos.z / Math.max(0.01, bodyScale)
    }

    // 9. Body breathing / sway ────────────────────────────────────────────────
    _applyBodySway(bodyGroupRef, bodyOffset, bodyScale, idle, currPose.current.bodyRotateX, currPose.current.bodyRotateY)
  })

  // ── Compute hand counter-scale ────────────────────────────────────────────
  const handsScale = bodyScale > 0 ? 0.0165 / bodyScale : 0.0165

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <group ref={groupRef} position={[0, -0.22, 0]}>
      <group
        ref={bodyGroupRef}
        position={[bodyOffset.x, bodyOffset.y, bodyOffset.z]}
        scale={bodyScale}
      >
        <primitive object={bodyScene} />

        {/* Rigged hands nested inside body group — inherits breathing & sway */}
        <group
          ref={handsGroupRef}
          position={[0.0, 2.72, 0.15]}
          scale={handsScale}
          rotation={[0.02, Math.PI, 0]}
        >
          <primitive object={handsScene} />
        </group>
      </group>
    </group>
  )
}

// ── Shared body sway helper (avoids repeating code in mirror branch) ──────────
function _applyBodySway(bodyGroupRef, bodyOffset, bodyScale, idle, bodyRotateX = 0, bodyRotateY = 0) {
  if (!bodyGroupRef.current) return
  bodyGroupRef.current.position.y = bodyOffset.y + idle.body.breathY * 0.7
  bodyGroupRef.current.scale.y    = bodyScale * idle.body.scaleY
  bodyGroupRef.current.rotation.x = bodyRotateX * DEG + idle.body.headTiltX * 0.5
  bodyGroupRef.current.rotation.y = bodyRotateY * DEG + idle.body.swayX
  bodyGroupRef.current.rotation.z = idle.body.swayZ
}
