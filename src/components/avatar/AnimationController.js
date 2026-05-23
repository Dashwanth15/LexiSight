// AnimationController.js — Programmatic ISL Animation Compiler & Mixer Manager
// ──────────────────────────────────────────────────────────────────────────────
// This module compiles declarative signs (from SignLibrary.jsx) into Three.js
// AnimationClips at runtime and wraps the THREE.AnimationMixer for smooth transitions.
// ──────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three'
import { HAND_SHAPES, ARM_POSITIONS } from './SignLibrary.jsx'

const DEG = Math.PI / 180
const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky']

// Rig Bone Name Map
export const BONE_NAMES = {
  // Spine & Head
  spine1: 'CC_Base_Spine01_034',
  spine2: 'CC_Base_Spine02_035',
  neck: 'CC_Base_NeckTwist01_036',
  head: 'CC_Base_Head_038',

  // Right Arm
  clavicleR: 'CC_Base_R_Clavicle_080',
  upperArmR: 'CC_Base_R_Upperarm_081',
  forearmR: 'CC_Base_R_Forearm_082',
  handR: 'CC_Base_R_Hand_086',

  // Left Arm
  clavicleL: 'CC_Base_L_Clavicle_052',
  upperArmL: 'CC_Base_L_Upperarm_053',
  forearmL: 'CC_Base_L_Forearm_054',
  handL: 'CC_Base_L_Hand_058',

  // Right Fingers
  thumbR: ['CC_Base_R_Thumb1_093', 'CC_Base_R_Thumb2_094', 'CC_Base_R_Thumb3_095'],
  indexR: ['CC_Base_R_Index1_096', 'CC_Base_R_Index2_097', 'CC_Base_R_Index3_098'],
  middleR: ['CC_Base_R_Mid1_090', 'CC_Base_R_Mid2_091', 'CC_Base_R_Mid3_092'],
  ringR: ['CC_Base_R_Ring1_087', 'CC_Base_R_Ring2_088', 'CC_Base_R_Ring3_089'],
  pinkyR: ['CC_Base_R_Pinky1_099', 'CC_Base_R_Pinky2_0100', 'CC_Base_R_Pinky3_0101'],

  // Left Fingers
  thumbL: ['CC_Base_L_Thumb1_071', 'CC_Base_L_Thumb2_072', 'CC_Base_L_Thumb3_073'],
  indexL: ['CC_Base_L_Index1_068', 'CC_Base_L_Index2_069', 'CC_Base_L_Index3_070'],
  middleL: ['CC_Base_L_Mid1_065', 'CC_Base_L_Mid2_066', 'CC_Base_L_Mid3_067'],
  ringL: ['CC_Base_L_Ring1_062', 'CC_Base_L_Ring2_063', 'CC_Base_L_Ring3_064'],
  pinkyL: ['CC_Base_L_Pinky1_059', 'CC_Base_L_Pinky2_060', 'CC_Base_L_Pinky3_061']
}

// Helper to compute Euler rotations and multiply by rest quaternions
function getRotatedQuaternion(restQ, rx, ry, rz, order = 'XYZ') {
  if (!restQ) return new THREE.Quaternion()
  const euler = new THREE.Euler(rx * DEG, ry * DEG, rz * DEG, order)
  const rotation = new THREE.Quaternion().setFromEuler(euler)
  return new THREE.Quaternion().multiplyQuaternions(restQ, rotation)
}

/**
 * Generates dynamic offsets and overrides for a given motion pattern at time t.
 */
function getMotionState(motion, t) {
  const state = {
    fingerR: {},
    fingerL: {},
    armOverrideR: null,
    armOverrideL: null,
    armOffsetR: { deltoidX: 0, deltoidY: 0, deltoidZ: 0, upperArmX: 0, upperArmY: 0, upperArmZ: 0, forearmX: 0, forearmY: 0, forearmZ: 0 },
    armOffsetL: { deltoidX: 0, deltoidY: 0, deltoidZ: 0, upperArmX: 0, upperArmY: 0, upperArmZ: 0, forearmX: 0, forearmY: 0, forearmZ: 0 },
    wristOffsetR: 0, // Z axis rotation (palmRotate)
    wristOffsetL: 0,
    wristRollOffsetR: 0, // Z axis roll (forearmExtZ)
    wristRollOffsetL: 0,
    body: { spineX: 0, spineY: 0, spineZ: 0, headX: 0, headY: 0, headZ: 0 }
  }

  const pulseSlow = Math.sin(t * Math.PI) // 1.0Hz full cycle
  const pulseFast = Math.sin(t * 2 * Math.PI) // 2.0Hz full cycle
  const cycleWave = Math.sin(t * 8) // wave/nod cycle
  const cycleFast = Math.sin(t * 12) // scribble cycle
  const cycleSlow = Math.sin(t * 4) // general slow cycle
  const cycleJitter = Math.sin(t * 30) // shiver

  switch (motion) {
    case 'wave':
      state.wristRollOffsetR = cycleWave * 20
      state.wristOffsetR = Math.cos(t * 8) * 10
      break

    case 'wristNod':
      state.wristOffsetR = cycleWave * 22
      state.wristOffsetL = cycleWave * 22
      break

    case 'beckon':
      state.fingerR.index = [cycleWave * 30 + 35, 45, 30]
      state.armOffsetR.forearmX = cycleWave * 5
      break

    case 'wiggle':
      FINGER_NAMES.forEach((f, idx) => {
        const val = Math.sin(t * 14 + idx * 1.5) * 15 + 15
        state.fingerR[f] = [val, val, val]
        state.fingerL[f] = [val, val, val]
      })
      break

    case 'pinchMouth':
      // Move hand up and down near mouth
      state.armOffsetR.forearmX = cycleSlow * 12 + 10
      state.armOffsetR.upperArmZ = -cycleSlow * 4
      break

    case 'walkLegs':
      // Index and middle fingers alternating bend
      state.fingerR.index = [Math.sin(t * 8) * 35 + 35, 40, 20]
      state.fingerR.middle = [Math.cos(t * 8) * 35 + 35, 40, 20]
      break

    case 'readSweep':
      state.armOffsetR.upperArmY = cycleSlow * 18
      state.armOffsetR.forearmY = cycleSlow * 10
      state.body.headX = 6
      state.body.headY = cycleSlow * 3
      break

    case 'writeScribble':
      state.wristOffsetR = cycleFast * 18
      state.armOffsetR.forearmX = Math.cos(t * 12) * 4
      break

    case 'excitedSway':
      state.body.spineY = cycleSlow * 6
      state.body.spineZ = Math.cos(t * 4) * 4
      state.body.headY = cycleSlow * -3
      state.armOffsetR.forearmX = cycleWave * 8
      state.armOffsetL.forearmX = -cycleWave * 8
      break

    case 'shiver':
      state.armOffsetR.forearmX = cycleJitter * 4
      state.armOffsetL.forearmX = -cycleJitter * 4
      state.body.spineX = cycleJitter * 1.5
      break

    case 'cheekRest':
      state.body.headZ = 12
      state.body.spineZ = 4
      state.armOffsetR.forearmX = 8
      state.armOffsetR.upperArmZ = -4
      break

    case 'chestCircle':
      state.armOffsetR.upperArmX = cycleWave * 8
      state.armOffsetR.upperArmZ = Math.cos(t * 8) * 8
      break

    case 'goodMorning':
      // Interpolate pose from chest thumbsUp to face flat
      if (t < 1.0) {
        const factor = t // 0 to 1
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.neutral, ARM_POSITIONS.chest, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.flat, HAND_SHAPES.thumbsUp, factor)
      } else {
        const factor = Math.min(1.0, (t - 1.0) / 1.5) // 0 to 1 over 1.5s
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.chest, ARM_POSITIONS.face, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.thumbsUp, HAND_SHAPES.flat, factor)
      }
      break

    case 'goodNight':
      // Interpolate pose from chest thumbsUp to sweeping flat down
      if (t < 1.0) {
        const factor = t
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.neutral, ARM_POSITIONS.chest, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.flat, HAND_SHAPES.thumbsUp, factor)
      } else {
        const factor = Math.min(1.0, (t - 1.0) / 1.5)
        const sweepPose = { ...ARM_POSITIONS.neutral, deltoidZ: -30, upperArmZ: -10, forearmX: 8, forearmExtZ: -25 }
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.chest, sweepPose, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.thumbsUp, HAND_SHAPES.flat, factor)
      }
      break

    case 'welcome':
      // Sweep outward and back
      {
        const factor = (cycleSlow + 1) / 2 // 0 to 1
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.chest, ARM_POSITIONS.outward, factor)
      }
      break

    case 'thankyou':
      // Touch face and sweep forward
      {
        const factor = (Math.sin(t * 5) + 1) / 2
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.face, ARM_POSITIONS.forward, factor)
      }
      break

    case 'sadFaceDown':
      state.body.headX = 14
      state.body.spineX = 8
      break

    case 'tiredSlump':
      state.body.spineX = 12
      state.body.headX = 8
      state.armOffsetR.forearmX = -8
      state.armOffsetL.forearmX = -8
      break

    case 'pulseCheck':
      // Both hands at chest, right index/middle touch left wrist
      state.armOverrideR = { deltoidX: 0, deltoidY: -30, deltoidZ: -45, upperArmX: 0, upperArmY: -10, upperArmZ: -15, forearmX: 38, forearmExtZ: 25 }
      state.armOverrideL = { deltoidX: 0, deltoidY: -10, deltoidZ: -35, upperArmX: 0, upperArmY: 5, upperArmZ: -15, forearmX: 25, forearmExtZ: -10 }
      break

    case 'crossDraw':
      // Draw cross on left shoulder using right hand index
      {
        const factorX = Math.sin(t * 8) * 15
        const factorY = Math.cos(t * 8) * 15
        state.armOverrideR = { deltoidX: 0, deltoidY: -28 + factorY * 0.3, deltoidZ: -45 + factorX * 0.3, upperArmX: 0, upperArmY: -15, upperArmZ: -10, forearmX: 32, forearmExtZ: 10 }
      }
      break

    case 'painTwist':
      state.wristOffsetR = cycleWave * 25
      state.wristOffsetL = -cycleWave * 25
      break

    case 'clapDouble':
      state.armOffsetR.upperArmY = cycleWave * 12
      state.armOffsetL.upperArmY = -cycleWave * 12
      break

    case 'teachForward':
      {
        const factor = (cycleWave + 1) / 2
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.face, ARM_POSITIONS.forward, factor)
        state.armOverrideL = blendArmPositions(ARM_POSITIONS.face, ARM_POSITIONS.forward, factor)
      }
      break

    case 'studentSign':
      // Learn sign (0-1.5s) then arms down
      if (t < 1.5) {
        const factor = t / 1.5
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.neutral, ARM_POSITIONS.face, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.flat, HAND_SHAPES.pinched, factor)
      } else {
        const factor = Math.min(1.0, (t - 1.5) / 1.5)
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.face, ARM_POSITIONS.rest, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.pinched, HAND_SHAPES.flat, factor)
      }
      break

    case 'bookOpen':
      {
        const factor = (cycleSlow + 1) / 2
        state.wristRollOffsetR = factor * 45
        state.wristRollOffsetL = -factor * 45
      }
      break

    case 'learnMind':
      if (t < 1.5) {
        const factor = t / 1.5
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.chest, ARM_POSITIONS.face, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.flat, HAND_SHAPES.pinched, factor)
      } else {
        const factor = Math.min(1.0, (t - 1.5) / 1.5)
        state.armOverrideR = blendArmPositions(ARM_POSITIONS.face, ARM_POSITIONS.chest, factor)
        state.fingerR = blendHandShapes(HAND_SHAPES.pinched, HAND_SHAPES.flat, factor)
      }
      break

    case 'examScribble':
      state.armOffsetR.forearmX = cycleWave * 6
      state.armOffsetL.forearmX = -cycleWave * 6
      state.wristOffsetR = cycleFast * 12
      break

    case 'rubIndices':
      state.armOffsetR.forearmX = cycleWave * 4
      state.armOffsetL.forearmX = -cycleWave * 4
      break

    default:
      // Breathing/Idle loop
      const breath = Math.sin(t * 1.4)
      state.body.spineY = breath * 1.0
      state.body.headX = breath * 0.8
      state.armOffsetR.deltoidZ = breath * 1.2
      state.armOffsetL.deltoidZ = breath * 1.2
      break
  }

  return state
}

// Blend helpers
function blendArmPositions(p1, p2, f) {
  const blend = {}
  for (const k of Object.keys(p1)) {
    blend[k] = p1[k] + (p2[k] - p1[k]) * f
  }
  return blend
}

function blendHandShapes(s1, s2, f) {
  const blend = { palmRotate: s1.palmRotate + (s2.palmRotate - s1.palmRotate) * f }
  FINGER_NAMES.forEach(finger => {
    blend[finger] = s1[finger].map((val, idx) => val + (s2[finger][idx] - val) * f)
  })
  return blend
}

/**
 * Compiles a single sign dictionary item into a THREE.AnimationClip.
 */
export function compileSignToClip(sign, restQuaternions, duration = 3.0, fps = 30) {
  const trackMap = {} // boneName -> array of values

  const times = []
  const step = 1 / fps
  const numSteps = Math.ceil(duration * fps)

  for (let i = 0; i <= numSteps; i++) {
    times.push(i * step)
  }

  // Pre-initialize empty value arrays for all bones
  const bonesToAnimate = [
    BONE_NAMES.spine1, BONE_NAMES.spine2, BONE_NAMES.neck, BONE_NAMES.head,
    BONE_NAMES.upperArmR, BONE_NAMES.forearmR, BONE_NAMES.handR,
    BONE_NAMES.upperArmL, BONE_NAMES.forearmL, BONE_NAMES.handL
  ]
  FINGER_NAMES.forEach(f => {
    BONE_NAMES[`${f}R`].forEach(b => bonesToAnimate.push(b))
    BONE_NAMES[`${f}L`].forEach(b => bonesToAnimate.push(b))
  })

  bonesToAnimate.forEach(b => {
    trackMap[b] = []
  })

  // Sample values at each time step
  times.forEach(t => {
    const motionState = getMotionState(sign.motion, t)

    // 1. Determine active Arm Positions
    const baseArmR = motionState.armOverrideR || ARM_POSITIONS[sign.armPositionR] || ARM_POSITIONS.rest
    const baseArmL = motionState.armOverrideL || ARM_POSITIONS[sign.armPositionL] || ARM_POSITIONS.rest

    // Apply motion offsets to Arm Positions
    const armR = {
      deltoidX: baseArmR.deltoidX + motionState.armOffsetR.deltoidX,
      deltoidY: baseArmR.deltoidY + motionState.armOffsetR.deltoidY,
      deltoidZ: baseArmR.deltoidZ + motionState.armOffsetR.deltoidZ,
      upperArmX: baseArmR.upperArmX + motionState.armOffsetR.upperArmX,
      upperArmY: baseArmR.upperArmY + motionState.armOffsetR.upperArmY,
      upperArmZ: baseArmR.upperArmZ + motionState.armOffsetR.upperArmZ,
      forearmX: baseArmR.forearmX + motionState.armOffsetR.forearmX,
      forearmY: baseArmR.forearmY + motionState.armOffsetR.forearmY,
      forearmZ: baseArmR.forearmZ + motionState.armOffsetR.forearmZ,
      forearmExtZ: baseArmR.forearmExtZ + motionState.wristRollOffsetR
    }

    const armL = {
      deltoidX: baseArmL.deltoidX + motionState.armOffsetL.deltoidX,
      deltoidY: baseArmL.deltoidY + motionState.armOffsetL.deltoidY,
      deltoidZ: baseArmL.deltoidZ + motionState.armOffsetL.deltoidZ,
      upperArmX: baseArmL.upperArmX + motionState.armOffsetL.upperArmX,
      upperArmY: baseArmL.upperArmY + motionState.armOffsetL.upperArmY,
      upperArmZ: baseArmL.upperArmZ + motionState.armOffsetL.upperArmZ,
      forearmX: baseArmL.forearmX + motionState.armOffsetL.forearmX,
      forearmY: baseArmL.forearmY + motionState.armOffsetL.forearmY,
      forearmZ: baseArmL.forearmZ + motionState.armOffsetL.forearmZ,
      forearmExtZ: baseArmL.forearmExtZ + motionState.wristRollOffsetL
    }

    // 2. Determine Handshapes
    const shapeR = motionState.fingerR.index ? { ...HAND_SHAPES[sign.handShapeR], ...motionState.fingerR } : HAND_SHAPES[sign.handShapeR] || HAND_SHAPES.flat
    const shapeL = motionState.fingerL.index ? { ...HAND_SHAPES[sign.handShapeL], ...motionState.fingerL } : HAND_SHAPES[sign.handShapeL] || HAND_SHAPES.flat

    // 3. Compute Body spine/head rotations
    const bodyRotX = (sign.bodyRotateX || 0) + motionState.body.spineX
    const bodyRotY = (sign.bodyRotateY || 0) + motionState.body.spineY
    const bodyRotZ = motionState.body.spineZ

    const headRotX = motionState.body.headX
    const headRotY = motionState.body.headY
    const headRotZ = motionState.body.headZ

    // Convert Eulers to Quaternions and store
    // Body (Divide angles slightly down the chain for natural curve)
    const qSpine1 = getRotatedQuaternion(restQuaternions[BONE_NAMES.spine1], bodyRotX * 0.4, bodyRotY * 0.4, bodyRotZ * 0.4)
    const qSpine2 = getRotatedQuaternion(restQuaternions[BONE_NAMES.spine2], bodyRotX * 0.6, bodyRotY * 0.6, bodyRotZ * 0.6)
    const qNeck = getRotatedQuaternion(restQuaternions[BONE_NAMES.neck], headRotX * 0.3, headRotY * 0.3, headRotZ * 0.3)
    const qHead = getRotatedQuaternion(restQuaternions[BONE_NAMES.head], headRotX * 0.7, headRotY * 0.7, headRotZ * 0.7)

    qSpine1.toArray(trackMap[BONE_NAMES.spine1], trackMap[BONE_NAMES.spine1].length)
    qSpine2.toArray(trackMap[BONE_NAMES.spine2], trackMap[BONE_NAMES.spine2].length)
    qNeck.toArray(trackMap[BONE_NAMES.neck], trackMap[BONE_NAMES.neck].length)
    qHead.toArray(trackMap[BONE_NAMES.head], trackMap[BONE_NAMES.head].length)

    // Right Arm: upperArm (deltoid + upperArm combined), forearm, hand/wrist
    const qUpperR = getRotatedQuaternion(
      restQuaternions[BONE_NAMES.upperArmR],
      armR.deltoidX + armR.upperArmX,
      armR.deltoidY + armR.upperArmY,
      armR.deltoidZ + armR.upperArmZ
    )
    const qForearmR = getRotatedQuaternion(restQuaternions[BONE_NAMES.forearmR], armR.forearmX, armR.forearmY, armR.forearmZ)
    const qHandR = getRotatedQuaternion(restQuaternions[BONE_NAMES.handR], 0, 0, armR.forearmExtZ + shapeR.palmRotate + motionState.wristOffsetR)

    qUpperR.toArray(trackMap[BONE_NAMES.upperArmR], trackMap[BONE_NAMES.upperArmR].length)
    qForearmR.toArray(trackMap[BONE_NAMES.forearmR], trackMap[BONE_NAMES.forearmR].length)
    qHandR.toArray(trackMap[BONE_NAMES.handR], trackMap[BONE_NAMES.handR].length)

    // Left Arm (Mirrored along Y and Z axes)
    const qUpperL = getRotatedQuaternion(
      restQuaternions[BONE_NAMES.upperArmL],
      armL.deltoidX + armL.upperArmX,
      -(armL.deltoidY + armL.upperArmY),
      -(armL.deltoidZ + armL.upperArmZ)
    )
    const qForearmL = getRotatedQuaternion(restQuaternions[BONE_NAMES.forearmL], armL.forearmX, -armL.forearmY, -armL.forearmZ)
    const qHandL = getRotatedQuaternion(restQuaternions[BONE_NAMES.handL], 0, 0, -(armL.forearmExtZ + shapeL.palmRotate + motionState.wristOffsetL))

    qUpperL.toArray(trackMap[BONE_NAMES.upperArmL], trackMap[BONE_NAMES.upperArmL].length)
    qForearmL.toArray(trackMap[BONE_NAMES.forearmL], trackMap[BONE_NAMES.forearmL].length)
    qHandL.toArray(trackMap[BONE_NAMES.handL], trackMap[BONE_NAMES.handL].length)

    // Fingers R
    FINGER_NAMES.forEach(f => {
      const angles = shapeR[f] || [0, 0, 0]
      const boneList = BONE_NAMES[`${f}R`]
      for (let i = 0; i < 3; i++) {
        const bone = boneList[i]
        const rest = restQuaternions[bone]
        let q = getRotatedQuaternion(rest, angles[i], 0, 0)
        // thumb special joint-0 sweep
        if (f === 'thumb' && i === 0) {
          const qThumbZ = getRotatedQuaternion(rest, angles[0], 0, angles[0] * 0.28)
          q = qThumbZ
        }
        q.toArray(trackMap[bone], trackMap[bone].length)
      }
    })

    // Fingers L
    FINGER_NAMES.forEach(f => {
      const angles = shapeL[f] || [0, 0, 0]
      const boneList = BONE_NAMES[`${f}L`]
      for (let i = 0; i < 3; i++) {
        const bone = boneList[i]
        const rest = restQuaternions[bone]
        let q = getRotatedQuaternion(rest, angles[i], 0, 0)
        // thumb special joint-0 sweep (mirrored Z direction)
        if (f === 'thumb' && i === 0) {
          const qThumbZ = getRotatedQuaternion(rest, angles[0], 0, -angles[0] * 0.28)
          q = qThumbZ
        }
        q.toArray(trackMap[bone], trackMap[bone].length)
      }
    })
  })

  // Build QuaternionKeyframeTrack tracks
  const tracks = []
  Object.keys(trackMap).forEach(boneName => {
    tracks.push(
      new THREE.QuaternionKeyframeTrack(
        `${boneName}.quaternion`,
        times,
        trackMap[boneName]
      )
    )
  })

  return new THREE.AnimationClip(sign.id, duration, tracks)
}

/**
 * Compiles all signs from dictionary, including a default 'idle' loop.
 */
export function compileAllClips(dictionary, restQuaternions) {
  const clips = {}

  // 1. Compile standard dictionary signs
  dictionary.forEach(sign => {
    clips[sign.id] = compileSignToClip(sign, restQuaternions, 3.0, 30)
  })

  // 2. Compile default 'idle' breathing animation
  const idleSign = {
    id: 'idle',
    label: 'IDLE',
    handShapeR: 'flat', handShapeL: 'flat',
    armPositionR: 'rest', armPositionL: 'rest',
    motion: 'idle',
    bodyRotateX: 0, bodyRotateY: 0
  }
  clips['idle'] = compileSignToClip(idleSign, restQuaternions, 4.5, 30)

  return clips
}

/**
 * AnimationController Class
 * Wraps a THREE.AnimationMixer and coordinates cross-fading, playback speed, and loop cycles.
 */
export class AnimationController {
  constructor(mixer, clips) {
    this.mixer = mixer
    this.clips = clips
    this.actions = {}
    this.currentAction = null
    this.currentSignId = 'idle'

    // Instantiate actions
    Object.keys(clips).forEach(id => {
      const action = mixer.clipAction(clips[id])
      action.setLoop(THREE.LoopRepeat)
      action.clampWhenFinished = false
      this.actions[id] = action
    })

    // Start by playing idle
    if (this.actions['idle']) {
      this.actions['idle'].play()
      this.currentAction = this.actions['idle']
    }
  }

  /**
   * Plays a sign animation by id with a smooth cross-fade transition.
   */
  playSign(id, speed = 1.0, slowMotion = false) {
    const nextAction = this.actions[id]
    if (!nextAction) return

    if (this.currentAction === nextAction) {
      // Re-trigger from start if already playing
      nextAction.reset()
      nextAction.setEffectiveTimeScale(speed * (slowMotion ? 0.25 : 1.0))
      nextAction.play()
      return
    }

    const duration = 0.25 // 250ms crossfade duration
    nextAction.reset()
    nextAction.setEffectiveTimeScale(speed * (slowMotion ? 0.25 : 1.0))
    nextAction.setEffectiveWeight(1.0)

    if (this.currentAction) {
      nextAction.play()
      this.currentAction.crossFadeTo(nextAction, duration, true)
    } else {
      nextAction.fadeIn(duration).play()
    }

    this.currentAction = nextAction
    this.currentSignId = id
  }

  /**
   * Restores the character back to the idle loop.
   */
  resetToIdle(speed = 1.0) {
    this.playSign('idle', speed, false)
  }

  /**
   * Sets global playback speed.
   */
  setSpeed(speedVal) {
    if (this.currentAction) {
      this.currentAction.setEffectiveTimeScale(speedVal)
    }
  }

  /**
   * Pauses the animation mixer.
   */
  pause() {
    if (this.currentAction) {
      this.currentAction.paused = true
    }
  }

  /**
   * Resumes the animation mixer.
   */
  resume() {
    if (this.currentAction) {
      this.currentAction.paused = false
    }
  }

  /**
   * Updates the animation mixer timeline.
   */
  update(deltaTime) {
    this.mixer.update(deltaTime)
  }
}
