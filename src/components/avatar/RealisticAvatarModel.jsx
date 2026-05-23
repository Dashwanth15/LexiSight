// RealisticAvatarModel.jsx — Realistic 3D ISL Avatar for AvatarScene
// ──────────────────────────────────────────────────────────────────────────────
// Uses hight_quality_realistic_man_character.glb with declarative sign animations
// Designed to work inside AvatarScene's Canvas (no nested Canvas)
// ──────────────────────────────────────────────────────────────────────────────

import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { compileAllClips, AnimationController } from './AnimationController.js'
import { SIGN_DICTIONARY } from './SignLibrary.jsx'

/**
 * RealisticAvatarModel — Avatar component for embedding in existing Canvas
 * Props:
 *   - gesture: sign ID to play (e.g., 'hello', 'thankyou', 'idle')
 *   - isActive: whether gesture is currently playing
 *   - speed: playback speed multiplier (1.0 = normal)
 *   - slowMotion: boolean for half-speed mode
 *   - isPaused: pause playback
 *   - replayTrigger: increment this to restart current animation
 */
export default function RealisticAvatarModel({
  gesture = 'idle',
  isActive = false,
  speed = 1.0,
  slowMotion = false,
  isPaused = false,
  replayTrigger = 0
}) {
  const { scene } = useGLTF('/models/hight_quality_realistic_man_character.glb')
  const modelRef = useRef()
  const mixerRef = useRef(null)
  const controllerRef = useRef(null)

  const [scale, setScale] = useState(1.0)
  const [positionOffset, setPositionOffset] = useState([0, -0.9, 0])

  // Extract rest quaternions for all bones
  const restQuaternions = useMemo(() => {
    const map = {}
    scene.traverse(child => {
      if (child.isBone) {
        map[child.name] = child.quaternion.clone()
      }
    })
    return map
  }, [scene])

  // Programmatically compile dictionary gestures
  const compiledClips = useMemo(() => {
    if (Object.keys(restQuaternions).length === 0) return null
    return compileAllClips(SIGN_DICTIONARY, restQuaternions)
  }, [restQuaternions])

  // Setup AnimationMixer and Controller
  useEffect(() => {
    if (!compiledClips) return

    const mixer = new THREE.AnimationMixer(scene)
    mixerRef.current = mixer

    const controller = new AnimationController(mixer, compiledClips)
    controllerRef.current = controller

    return () => {
      mixer.stopAllAction()
    }
  }, [scene, compiledClips])

  // Apply materials optimization for realistic skin/suit textures
  useEffect(() => {
    scene.traverse(obj => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach(mat => {
            mat.roughness = Math.min(mat.roughness || 0.5, 0.6)
            mat.metalness = Math.max(mat.metalness || 0.0, 0.15)
            mat.flatShading = false
            mat.needsUpdate = true
          })
        }
      }
    })

    // Compute size and auto-scale/center
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Standardize height to 1.70m
    const targetHeight = 1.70
    const sc = targetHeight / Math.max(0.01, size.y)
    setScale(sc)

    // Align feet with the surface of the pedestal at y = -0.9
    const yOffset = -0.9 - box.min.y * sc
    setPositionOffset([-center.x * sc, yOffset, -center.z * sc])
  }, [scene])

  // Handle gesture playback with speed/slowMotion
  useEffect(() => {
    if (!controllerRef.current) return

    const effectiveSpeed = slowMotion ? speed * 0.5 : speed

    if (gesture && gesture !== 'idle') {
      controllerRef.current.playSign(gesture, effectiveSpeed, slowMotion)
    } else {
      controllerRef.current.resetToIdle(effectiveSpeed)
    }
  }, [gesture, speed, slowMotion, replayTrigger])

  // Handle pause/resume
  useEffect(() => {
    if (!controllerRef.current) return
    if (isPaused) {
      controllerRef.current.pause()
    } else {
      controllerRef.current.resume()
    }
  }, [isPaused])

  // Render loop: update mixer
  useFrame((state, delta) => {
    if (mixerRef.current && !isPaused) {
      mixerRef.current.update(delta)
    }
  })

  return (
    <primitive 
      ref={modelRef}
      object={scene} 
      position={positionOffset} 
      scale={[scale, scale, scale]} 
    />
  )
}

// Preload the model asset
useGLTF.preload('/models/hight_quality_realistic_man_character.glb')
