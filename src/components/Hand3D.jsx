import { useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Float } from '@react-three/drei'
import * as THREE from 'three'

// ── 3D Hand Component with Realistic Rendering and Speech-to-Sign Integration ──────────────────────

// Hand gesture poses mapped to 3D transformations
const HAND_POSES = {
  idle: {
    thumb: { rotation: [0, 0.3, 0], position: [0.8, 0.2, 0] },
    index: { rotation: [0, 0, 0], position: [0.3, 0.8, 0] },
    middle: { rotation: [0, 0, 0], position: [0, 0.85, 0] },
    ring: { rotation: [0, 0, 0], position: [-0.3, 0.8, 0] },
    pinky: { rotation: [0, 0, 0], position: [-0.6, 0.7, 0] },
    palm: { rotation: [0, 0, 0], scale: [1, 1, 0.3] }
  },
  hello: {
    thumb: { rotation: [-0.3, 0.5, 0], position: [0.9, 0.1, 0] },
    index: { rotation: [-0.1, 0, 0], position: [0.4, 0.9, 0] },
    middle: { rotation: [-0.1, 0, 0], position: [0, 0.95, 0] },
    ring: { rotation: [-0.1, 0, 0], position: [-0.4, 0.9, 0] },
    pinky: { rotation: [-0.2, 0.2, 0], position: [-0.7, 0.8, 0] },
    palm: { rotation: [0.2, 0, 0], scale: [1.2, 1, 0.3] }
  },
  yes: {
    thumb: { rotation: [-1.2, 0.3, 0], position: [0.6, -0.3, 0.2] },
    index: { rotation: [1.5, 0, 0], position: [0.3, 0.3, 0] },
    middle: { rotation: [1.5, 0, 0], position: [0, 0.3, 0] },
    ring: { rotation: [1.5, 0, 0], position: [-0.3, 0.3, 0] },
    pinky: { rotation: [1.5, 0, 0], position: [-0.6, 0.3, 0] },
    palm: { rotation: [-0.3, 0, 0], scale: [1, 1.1, 0.3] }
  },
  no: {
    thumb: { rotation: [0, 0.3, 0], position: [0.8, 0.2, 0] },
    index: { rotation: [-0.1, 0, 0], position: [0.3, 0.8, 0] },
    middle: { rotation: [1.5, 0, 0], position: [0, 0.3, 0] },
    ring: { rotation: [1.5, 0, 0], position: [-0.3, 0.3, 0] },
    pinky: { rotation: [1.5, 0, 0], position: [-0.6, 0.3, 0] },
    palm: { rotation: [0, 0, 0], scale: [1, 1, 0.3] }
  },
  thankyou: {
    thumb: { rotation: [-0.2, 0.4, 0], position: [0.7, 0.3, 0] },
    index: { rotation: [-0.1, 0, 0], position: [0.3, 0.8, 0] },
    middle: { rotation: [-0.1, 0, 0], position: [0, 0.85, 0] },
    ring: { rotation: [-0.1, 0, 0], position: [-0.3, 0.8, 0] },
    pinky: { rotation: [-0.1, 0, 0], position: [-0.6, 0.7, 0] },
    palm: { rotation: [0.3, 0, 0], scale: [1, 1, 0.3] }
  },
  please: {
    thumb: { rotation: [-0.1, 0.3, 0], position: [0.7, 0.3, 0] },
    index: { rotation: [-0.1, 0, 0], position: [0.3, 0.8, 0] },
    middle: { rotation: [-0.1, 0, 0], position: [0, 0.85, 0] },
    ring: { rotation: [-0.1, 0, 0], position: [-0.3, 0.8, 0] },
    pinky: { rotation: [-0.1, 0, 0], position: [-0.6, 0.7, 0] },
    palm: { rotation: [0.4, 0, 0], scale: [1, 1, 0.3] }
  },
  love: {
    thumb: { rotation: [-0.5, 0.2, 0], position: [0.6, 0.1, 0.1] },
    index: { rotation: [0.3, 0, 0], position: [0.3, 0.6, 0] },
    middle: { rotation: [0.3, 0, 0], position: [0, 0.6, 0] },
    ring: { rotation: [0.3, 0, 0], position: [-0.3, 0.6, 0] },
    pinky: { rotation: [0.3, 0, 0], position: [-0.6, 0.6, 0] },
    palm: { rotation: [0.1, 0, 0], scale: [0.9, 0.9, 0.3] }
  }
}

// Finger component with realistic geometry
function Finger({ pose, color = '#8b5cf6', isActive = false, ...props }) {
  const meshRef = useRef()
  const [hovered, setHovered] = useState(false)

  useFrame((state) => {
    if (meshRef.current && isActive) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1
    }
  })

  const fingerGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    const width = 0.15
    const length = 0.8
    
    shape.moveTo(-width/2, 0)
    shape.lineTo(-width/2, length)
    shape.quadraticCurveTo(0, length + 0.1, width/2, length)
    shape.lineTo(width/2, 0)
    shape.closePath()
    
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 8
    })
  }, [])

  return (
    <mesh
      ref={meshRef}
      geometry={fingerGeometry}
      position={pose.position}
      rotation={pose.rotation}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
      {...props}
    >
      <meshStandardMaterial
        color={hovered ? '#00ff88' : color}
        roughness={0.3}
        metalness={0.1}
        emissive={isActive ? color : '#000000'}
        emissiveIntensity={isActive ? 0.2 : 0}
      />
    </mesh>
  )
}

// Palm component
function Palm({ pose, isActive = false, children, ...props }) {
  const meshRef = useRef()

  useFrame((state) => {
    if (meshRef.current && isActive) {
      meshRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.5) * 0.05
    }
  })

  const palmGeometry = useMemo(() => {
    const shape = new THREE.Shape()
    const width = 2
    const height = 2.5
    
    shape.moveTo(-width/2, -height/2)
    shape.lineTo(-width/2 + 0.3, height/2)
    shape.quadraticCurveTo(0, height/2 + 0.2, width/2 - 0.3, height/2)
    shape.lineTo(width/2, -height/2)
    shape.quadraticCurveTo(0, -height/2 - 0.1, -width/2, -height/2)
    shape.closePath()
    
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 12
    })
  }, [])

  return (
    <mesh
      ref={meshRef}
      geometry={palmGeometry}
      position={pose.position}
      rotation={pose.rotation}
      scale={pose.scale}
      {...props}
    >
      <meshStandardMaterial
        color="#1a2535"
        roughness={0.4}
        metalness={0.05}
        emissive={isActive ? '#8b5cf6' : '#000000'}
        emissiveIntensity={isActive ? 0.1 : 0}
      />
      {children}
    </mesh>
  )
}

// Main 3D Hand Model
function Hand3DModel({ gesture = 'idle', isActive = false, onGestureComplete }) {
  const pose = HAND_POSES[gesture] || HAND_POSES.idle
  const groupRef = useRef()

  useFrame((state) => {
    if (groupRef.current) {
      // Subtle floating animation
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.1
    }
  })

  useEffect(() => {
    if (onGestureComplete) {
      const timer = setTimeout(onGestureComplete, 1000)
      return () => clearTimeout(timer)
    }
  }, [gesture, onGestureComplete])

  return (
    <group ref={groupRef}>
      <Palm pose={pose.palm} isActive={isActive}>
        <Finger pose={pose.thumb} isActive={isActive} color="#8b5cf6" />
        <Finger pose={pose.index} isActive={isActive} color="#06b6d4" />
        <Finger pose={pose.middle} isActive={isActive} color="#10b981" />
        <Finger pose={pose.ring} isActive={isActive} color="#f59e0b" />
        <Finger pose={pose.pinky} isActive={isActive} color="#ef4444" />
      </Palm>
    </group>
  )
}

// Scene setup with proper lighting
function Scene({ gesture, isActive, onGestureComplete }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={45} />
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={4}
        maxDistance={12}
        maxPolarAngle={Math.PI / 2}
        autoRotate={isActive}
        autoRotateSpeed={2}
      />
      
      <Environment preset="studio" background={false} />
      
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
      <pointLight position={[-10, -10, -5]} intensity={0.5} color="#8b5cf6" />
      
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.3}>
        <Hand3DModel 
          gesture={gesture} 
          isActive={isActive} 
          onGestureComplete={onGestureComplete}
        />
      </Float>
      
      <ContactShadows
        position={[0, -2, 0]}
        opacity={0.4}
        scale={10}
        blur={2}
        far={4}
      />
    </>
  )
}

// Main component wrapper
export default function Hand3D({ 
  gesture = 'idle', 
  isActive = false, 
  onGestureComplete,
  className = '',
  width = 400,
  height = 400
}) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="mt-2 text-sm text-gray-400">Loading 3D Hand...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <Canvas
        shadows
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        style={{ 
          background: 'radial-gradient(circle at center, #1a1f3a 0%, #0d1117 100%)',
          borderRadius: '12px'
        }}
      >
        <Scene 
          gesture={gesture} 
          isActive={isActive} 
          onGestureComplete={onGestureComplete}
        />
      </Canvas>
      
      {/* Gesture indicator */}
      {gesture !== 'idle' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="px-3 py-1 bg-black/50 backdrop-blur-sm rounded-full border border-purple-500/30">
            <span className="text-xs font-mono text-purple-400 uppercase tracking-wider">
              {gesture}
            </span>
          </div>
        </div>
      )}
      
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-4 right-4">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        </div>
      )}
    </div>
  )
}

// Speech-to-Sign integration helper
export function useSpeechToSign() {
  const [currentGesture, setCurrentGesture] = useState('idle')
  const [isTranslating, setIsTranslating] = useState(false)

  const translateWord = async (word) => {
    setIsTranslating(true)
    
    // Map common words to gestures
    const gestureMap = {
      'hello': 'hello',
      'yes': 'yes',
      'no': 'no',
      'thank': 'thankyou',
      'please': 'please',
      'love': 'love',
      'good': 'yes',
      'bad': 'no'
    }
    
    const gesture = gestureMap[word.toLowerCase()] || 'idle'
    setCurrentGesture(gesture)
    
    // Simulate translation delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsTranslating(false)
    return gesture
  }

  return {
    currentGesture,
    isTranslating,
    translateWord,
    setCurrentGesture
  }
}
