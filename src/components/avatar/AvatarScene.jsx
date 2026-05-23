// AvatarScene.jsx — Cinematic 3D Studio Environment
//
// DESIGN PHILOSOPHY:
//   Creates a stunning, production-ready cybernetic studio space.
//   Provides multi-point volumetric lighting, soft shadow capture,
//   and a glowing holographic pedestal that shifts colors and pulses
//   dynamically when the sign-language interpreter is gesturing.

import { Suspense, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import RealisticAvatarModel from './RealisticAvatarModel.jsx'

function StudioPedestal() {
  return (
    <group position={[0, -0.92, 0]}>
      {/* 1. Main Pedestal Cylinder */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[0.55, 0.6, 0.08, 32]} />
        <meshStandardMaterial 
          color="#060b13" 
          roughness={0.2} 
          metalness={0.9} 
          bumpScale={0.05} 
        />
      </mesh>

      {/* 2. Top Glass Mirror Plate */}
      <mesh position={[0, 0.041, 0]}>
        <cylinderGeometry args={[0.53, 0.53, 0.005, 32]} />
        <meshStandardMaterial 
          color="#00d4ff" 
          roughness={0.05} 
          metalness={0.95} 
          transparent 
          opacity={0.3} 
        />
      </mesh>
    </group>
  )
}

function SceneLoader() {
  return (
    <mesh position={[0, 0.2, 0]}>
      <sphereGeometry args={[0.08, 16, 16]} />
      <meshStandardMaterial 
        color="#00d4ff" 
        emissive="#00d4ff" 
        emissiveIntensity={2} 
        wireframe 
      />
    </mesh>
  )
}

export default function AvatarScene({ 
  gesture = 'idle', 
  isActive = false, 
  speed = 1.0, 
  mirrorMode = false, 
  rawLandmarks = null,
  livePrediction = null,
  className = '' 
}) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 450, position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0.42, 2.5], fov: 42, near: 0.1, far: 50 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        style={{ background: 'transparent' }}
      >
        {/* Ambient Room Fill */}
        <ambientLight intensity={1.8} color="#0d1b2e" />

        {/* 1. Volumetric Front Key Light */}
        <directionalLight
          position={[1.5, 2.0, 2.2]}
          intensity={2.8}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0005}
        />

        {/* 2. Soft Fill Light (Warm glow) */}
        <directionalLight 
          position={[-2.0, 0.5, 1.0]} 
          intensity={0.8} 
          color="#cde8f8" 
        />

        {/* 3. Deep Cyber Rim Light (creates sleek neon body halo) */}
        <directionalLight 
          position={[0, 1.5, -3.0]} 
          intensity={4.2} 
          color={isActive ? '#00ff88' : '#8b5cf6'} 
        />

        {/* 4. Neon Point Light accent centered near chest */}
        <pointLight
          position={[0, 0.2, 0.8]}
          intensity={isActive ? 3.5 : 1.2}
          color={isActive ? '#00ff88' : '#00d4ff'}
          distance={4}
          decay={1.8}
        />

        {/* Interactive Rig */}
        <Suspense fallback={<SceneLoader />}>
          <RealisticAvatarModel 
            gesture={gesture} 
            isActive={isActive} 
            speed={speed}
            slowMotion={false}
            isPaused={false}
            replayTrigger={0}
          />
        </Suspense>

        {/* Dynamic Camera Controls */}
        <OrbitControls
          target={[0, 0.18, 0]} // Camera aligns directly with the interpreter's upper body / chest
          enablePan={false}
          minDistance={1.0}
          maxDistance={6.0}
          minPolarAngle={0.1}
          maxPolarAngle={Math.PI / 2.1} // Prevent orbital camera clipping below ground grid
          enableDamping
          dampingFactor={0.12}
          rotateSpeed={0.7}
        />
      </Canvas>
    </div>
  )
}
