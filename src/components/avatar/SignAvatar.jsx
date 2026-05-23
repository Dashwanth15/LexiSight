// SignAvatar.jsx — High-Fidelity 3D Avatar Viewport
// ──────────────────────────────────────────────────────────────────────────────
// Renders the realistic man character model on a holographic stage with OrbitControls,
// studio lighting, and binds the AnimationController to the React Three Fiber loop.
// ──────────────────────────────────────────────────────────────────────────────

import { Suspense, useRef, useEffect, useState, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { compileAllClips, AnimationController } from './AnimationController.js'
import { SIGN_DICTIONARY } from './SignLibrary.jsx'

// Holographic Studio Pedestal
function StudioPedestal({ isActive }) {
  const glowMaterialRef = useRef()

  useFrame((state) => {
    if (glowMaterialRef.current) {
      // Pulse opacity and color intensity
      const pulse = Math.sin(state.clock.getElapsedTime() * 3) * 0.15 + 0.45
      glowMaterialRef.current.opacity = pulse
    }
  })

  return (
    <group position={[0, -0.9, 0]}>
      {/* Carbon fiber base ring */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[0.7, 0.75, 0.08, 32]} />
        <meshStandardMaterial 
          color="#060b13" 
          roughness={0.15} 
          metalness={0.9} 
        />
      </mesh>

      {/* Holographic Glowing Plate */}
      <mesh position={[0, 0.042, 0]}>
        <cylinderGeometry args={[0.67, 0.67, 0.005, 32]} />
        <meshStandardMaterial 
          ref={glowMaterialRef}
          color={isActive ? '#00ff88' : '#8b5cf6'} 
          roughness={0.05} 
          metalness={0.95} 
          transparent 
          opacity={0.5} 
          emissive={isActive ? '#00ff88' : '#8b5cf6'}
          emissiveIntensity={1.5}
        />
      </mesh>

      {/* Outer Neon Glow Ring */}
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.68, 0.70, 64]} />
        <meshBasicMaterial 
          color={isActive ? '#00ff88' : '#8b5cf6'} 
          side={THREE.DoubleSide} 
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  )
}

// Subtle grid stage for positioning
function StageGrid() {
  return (
    <gridHelper 
      args={[20, 20, '#1e293b', '#0f172a']} 
      position={[0, -0.9, 0]} 
    />
  )
}

// 3D Model Primitive Wrapper containing the animation loop
function AvatarModel({ 
  gesture, 
  speed, 
  slowMotion, 
  isPaused, 
  replayTrigger 
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
            // Ensure no flat shading
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

  // Handle play/pause, speed, and crossfading
  useEffect(() => {
    if (!controllerRef.current) return

    if (gesture && gesture !== 'idle') {
      controllerRef.current.playSign(gesture, speed, slowMotion)
    } else {
      controllerRef.current.resetToIdle(speed)
    }
  }, [gesture, speed, slowMotion, replayTrigger])

  useEffect(() => {
    if (!controllerRef.current) return
    if (isPaused) {
      controllerRef.current.pause()
    } else {
      controllerRef.current.resume()
    }
  }, [isPaused])

  // Render loop update
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

// Fallback Loader Spinner
function ViewportLoader() {
  return (
    <mesh position={[0, 0.18, 0]}>
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial 
        color="#8b5cf6" 
        emissive="#8b5cf6" 
        emissiveIntensity={1.5} 
        wireframe 
      />
    </mesh>
  )
}

// Main Canvas Viewport Component
export default function SignAvatar({
  gesture = 'idle',
  speed = 1.0,
  slowMotion = false,
  isPaused = false,
  replayTrigger = 0,
  className = ''
}) {
  const isActive = gesture !== 'idle'

  return (
    <div className={`relative w-full h-full min-h-[480px] bg-[#020617]/50 rounded-2xl border border-slate-800/80 overflow-hidden ${className}`}>
      {/* Stage Grid Overlay Label */}
      <div className="absolute top-4 left-4 z-10 flex items-center space-x-2 bg-slate-950/80 backdrop-blur border border-slate-800 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-slate-300">
        <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'}`}></span>
        <span>{isActive ? `SIGNING: ${gesture.toUpperCase().replace('LETTER-', '').replace('DIGIT-', '')}` : 'STANDBY IDLE'}</span>
      </div>

      <Canvas
        camera={{ position: [0, 0.45, 2.3], fof: 40, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
        dpr={[1, 1.5]}
        className="w-full h-full"
      >
        {/* Soft Ambient Fill */}
        <ambientLight intensity={1.5} color="#0b1329" />

        {/* Cinematic Key Light */}
        <directionalLight
          position={[2.0, 3.0, 2.5]}
          intensity={2.6}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
        />

        {/* Ambient Fill Light */}
        <directionalLight 
          position={[-2.5, 1.0, 1.5]} 
          intensity={0.6} 
          color="#bfdbfe" 
        />

        {/* Colorful Rim Lighting for Sleek Glow Profile */}
        <directionalLight 
          position={[0, 2.0, -3.0]} 
          intensity={3.8} 
          color={isActive ? '#00ff88' : '#8b5cf6'} 
        />

        {/* Pedestal Base Glow Accent */}
        <pointLight
          position={[0, -0.6, 0.5]}
          intensity={isActive ? 3.0 : 1.0}
          color={isActive ? '#00ff88' : '#8b5cf6'}
          distance={3}
          decay={2.0}
        />

        <Suspense fallback={<ViewportLoader />}>
          <AvatarModel 
            gesture={gesture}
            speed={speed}
            slowMotion={slowMotion}
            isPaused={isPaused}
            replayTrigger={replayTrigger}
          />
        </Suspense>

        <StudioPedestal isActive={isActive} />
        <StageGrid />

        <OrbitControls
          target={[0, 0.18, 0]} // Lock zoom/rotations centered on model upper body
          enablePan={false}
          minDistance={1.0}
          maxDistance={5.0}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.05} // Prevent camera rotating under the floor helper
          enableDamping
          dampingFactor={0.1}
          rotateSpeed={0.6}
        />
      </Canvas>
    </div>
  )
}

// Preload the model asset
useGLTF.preload('/models/hight_quality_realistic_man_character.glb')
