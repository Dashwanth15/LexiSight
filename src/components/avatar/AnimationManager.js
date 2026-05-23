// AnimationManager.js — Procedural Timing and Skeleton Projection
//
// DESIGN PHILOSOPHY:
//   Decouples the interpolation and skeletal math from the 3D scene.
//   Provides two major pipelines:
//     1. Procedural Sign-Language Engine: Generates time-dependent keyframe values
//        for arms, wrists, fingers, and body posture sways/breathing.
//     2. Live Camera Mirroring: Computes physical joint bending angles from raw MediaPipe
//        3D coordinates (21 landmarks) using vector dot products.

import { AVATAR_POSES, getPoseForGesture } from '../../data/avatarPoses.js'
import * as THREE from 'three'

// Constants
const RAD_TO_DEG = 180 / Math.PI
const FINGER_LM_MAP = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20]
}

/**
 * Calculates joint bend angles in degrees from MediaPipe 3D landmark points.
 * Uses vector projection (cosine angle) between adjacent bones.
 */
export function calculateMirrorPose(rawLandmarks) {
  if (!rawLandmarks || rawLandmarks.length < 21) return null

  const pose = {
    thumb: [0, 0, 0],
    index: [0, 0, 0],
    middle: [0, 0, 0],
    ring: [0, 0, 0],
    pinky: [0, 0, 0],
    palmRotate: 0,
    arm: { lift: -5, roll: -12 }, // comfortable raised arm height for live gesturing
    pos: { x: 0, y: 0.1, z: -0.05 }
  }

  // Calculate finger bends
  for (const [finger, joints] of Object.entries(FINGER_LM_MAP)) {
    const [mcpIdx, pipIdx, dipIdx, tipIdx] = joints
    
    // Joint 1: MCP bend (angle between wrist->MCP and MCP->PIP)
    pose[finger][0] = computeBendAngle(rawLandmarks[0], rawLandmarks[mcpIdx], rawLandmarks[pipIdx])
    
    // Joint 2: PIP bend (angle between MCP->PIP and PIP->DIP)
    pose[finger][1] = computeBendAngle(rawLandmarks[mcpIdx], rawLandmarks[pipIdx], rawLandmarks[dipIdx])
    
    // Joint 3: DIP bend (angle between PIP->DIP and DIP->Tip)
    pose[finger][2] = computeBendAngle(rawLandmarks[pipIdx], rawLandmarks[dipIdx], rawLandmarks[tipIdx])

    // Scale bends to match rig expectation (flexing toward palm should be positive angles)
    // MediaPipe tracker maps flat hands to straight segments (0 deg).
    // Max bend is clamped at 85 degrees for safety and natural range of motion.
    pose[finger] = pose[finger].map(angle => Math.min(85, Math.max(-10, angle)))
  }

  // Calculate wrist rotation (palmRotate) from Index-MCP (5) to Pinky-MCP (17) vector
  const ptIndexMcp = rawLandmarks[5]
  const ptPinkyMcp = rawLandmarks[17]
  if (ptIndexMcp && ptPinkyMcp) {
    const dx = ptPinkyMcp.x - ptIndexMcp.x
    const dy = ptPinkyMcp.y - ptIndexMcp.y
    // Hand tilt Z angle relative to horizontal camera line
    // Multiply by -1 for mirrored camera space direction matching rig rotation
    const angle = Math.atan2(dy, dx) * RAD_TO_DEG
    pose.palmRotate = Math.min(45, Math.max(-45, -angle))
  }

  return pose
}

/** Helper to compute angle in degrees between segment A (p1->p2) and segment B (p2->p3) */
function computeBendAngle(p1, p2, p3) {
  if (!p1 || !p2 || !p3) return 0

  const vA = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z }
  const vB = { x: p3.x - p2.x, y: p3.y - p2.y, z: p3.z - p2.z }

  const lenA = Math.sqrt(vA.x*vA.x + vA.y*vA.y + vA.z*vA.z)
  const lenB = Math.sqrt(vB.x*vB.x + vB.y*vB.y + vB.z*vB.z)
  if (lenA === 0 || lenB === 0) return 0

  const dot = vA.x*vB.x + vA.y*vB.y + vA.z*vB.z
  const cosTheta = dot / (lenA * lenB)
  
  // Angle of deflection (0 deg = straight line, 90 deg = right angle fold)
  const angleRad = Math.acos(Math.min(1, Math.max(-1, cosTheta)))
  return angleRad * RAD_TO_DEG
}

/**
 * Returns dynamic idle sway values based on accumulated time.
 * Simulates breathing (shoulders and torso) and tiny micro-movements.
 */
export function getIdleState(time, intensity = 1.0) {
  const breathCycle = Math.sin(time * 1.4) // 1.4 rad/s ~ 13 breaths/min
  const postSwayX   = Math.cos(time * 0.45) * 0.012 * intensity
  const postSwayZ   = Math.sin(time * 0.32) * 0.008 * intensity

  return {
    body: {
      breathY: breathCycle * 0.0035 * intensity,
      scaleY: 1.0 + breathCycle * 0.0018 * intensity,
      swayX: postSwayX,
      swayZ: postSwayZ,
      headTiltX: Math.sin(time * 0.5) * 0.02 * intensity,
      headTiltY: Math.cos(time * 0.3) * 0.015 * intensity
    },
    arms: {
      idleX: Math.sin(time * 0.6) * 0.022 * intensity,
      idleZ: Math.sin(time * 0.45) * 0.015 * intensity
    }
  }
}

/**
 * Normalizes user input prediction to matches AVATAR_POSES key patterns
 */
export { getPoseForGesture }
