// AvatarScene.jsx — R3F Canvas wrapper
// Camera target raised to [0, 0.05, 0] based on screenshot analysis
// (hands appear in upper portion → they sit above previous target of -0.28)
// Ring radius reduced from 0.42 → 0.14 so hands appear bigger relative to ring

import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import HandAvatar3D from './HandAvatar3D.jsx'

function Loader() {
  return (
    <mesh>
      <sphereGeometry args={[0.05, 12, 12]} />
      <meshStandardMaterial color="#00d4ff" emissive="#00d4ff" emissiveIntensity={2} wireframe />
    </mesh>
  )
}

export default function AvatarScene({ gesture = 'idle', isActive = false, speed = 1, className = '' }) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 420 }}>
      <Canvas
        camera={{ position: [0, 1.0, 3.8], fov: 52, near: 0.01, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
        shadows
        dpr={[1, 1.5]}
        frameloop="always"
        style={{ background: 'transparent' }}
      >
        {/* Lighting */}
        <ambientLight intensity={2.6} color="#cde8f8" />

        <directionalLight
          position={[1, 2, 3]}
          intensity={3.2}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-2, 0.5, 1.5]} intensity={1.0} color="#88bbf0" />
        <directionalLight position={[0, -1, -2]}    intensity={0.4} color="#9b8fff" />

        {/* Dynamic gesture accent */}
        <pointLight
          position={[0, 1.0, 1.5]}
          intensity={isActive ? 4.5 : 1.8}
          color={isActive ? '#00ff88' : '#00d4ff'}
          distance={5}
          decay={2}
        />
        <pointLight position={[-0.5, -0.1, 1]} intensity={0.9} color="#a78bfa" />

        {/* Shadow plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]} receiveShadow>
          <planeGeometry args={[6, 6]} />
          <shadowMaterial opacity={0.15} />
        </mesh>

        {/* Glow ring — small radius so hands dominate the view, pushed way down */}
        {isActive && (
          <mesh position={[0, -0.4, 0]}>
            <torusGeometry args={[0.3, 0.008, 8, 64]} />
            <meshStandardMaterial
              color="#00ff88" emissive="#00ff88"
              emissiveIntensity={5} transparent opacity={0.8}
            />
          </mesh>
        )}

        <Suspense fallback={<Loader />}>
          <HandAvatar3D gesture={gesture} isActive={isActive} speed={speed} />
        </Suspense>

        {/* Camera aims at the hands */}
        <OrbitControls
          target={[0, 1.0, 0]}
          enablePan={false}
          minDistance={0.6}
          maxDistance={10}
          autoRotate={false}
          enableDamping
          dampingFactor={0.2}
          rotateSpeed={0.8}
        />
      </Canvas>
    </div>
  )
}
