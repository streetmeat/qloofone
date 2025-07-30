"use client"

import { useMemo, useRef, useEffect, useState } from "react"
import { Center, Text3D } from "@react-three/drei"
import * as THREE from "three"
import type { MeshProps } from "@react-three/fiber"
import { useFrame } from "@react-three/fiber"

/* ───────────────────── Ribbon ───────────────────── */
function OvalRibbon(props: MeshProps & { opacity: number }) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const { geometry } = useMemo(() => {
    const a = 8,
      b = 3.5
    const tubularSegments = 800
    const radialSegments = 18
    const baseRadius = 0.6
    const points = []
    const steps = 300
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2
      points.push(new THREE.Vector3(a * Math.cos(t), 0, b * Math.sin(t)))
    }
    const path = new THREE.CatmullRomCurve3(points, true)
    const geo = new THREE.TubeGeometry(path, tubularSegments, baseRadius, radialSegments, true)
    const pos = geo.attributes.position
    const norm = geo.attributes.normal
    const tmp = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      const angle = (i / pos.count) * Math.PI * 2
      // Reverted to v31 style: thickest at top/bottom
      const scale = 1 + 0.45 * Math.cos(2 * angle)
      tmp.fromBufferAttribute(norm, i).multiplyScalar(baseRadius * (scale - 1))
      pos.setXYZ(i, pos.getX(i) + tmp.x, pos.getY(i) + tmp.y, pos.getZ(i) + tmp.z)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return { geometry: geo }
  }, [])

  // Animate the ribbon with an extremely subtle rotation (less than 1 degree)
  // to make it feel grounded and stable.
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const elapsedTime = clock.getElapsedTime()
      // Reduced magnitude to 0.008 radians (approx. 0.45 degrees)
      meshRef.current.rotation.x = Math.PI / 2 + Math.sin(elapsedTime * 0.3) * 0.008
      meshRef.current.rotation.y = 0.06 + Math.cos(elapsedTime * 0.2) * 0.008
    }
  })

  return (
    <mesh ref={meshRef} geometry={geometry} {...props} receiveShadow>
      <meshPhysicalMaterial
        color="#FF2975" // Project's accent pink
        roughness={0.25}
        metalness={0.8}
        clearcoat={0.2}
        clearcoatRoughness={0.05}
        sheen={1}
        sheenRoughness={0.4}
        transparent
        opacity={props.opacity}
      />
    </mesh>
  )
}

/* ───────────────────── Text ───────────────────── */
function LogoText(props: any & { opacity: number }) {
  const groupRef = useRef<THREE.Group>(null!)
  const font = "/fonts/helvetiker_bold.typeface.json"

  // Animate the text to feel like it's weightlessly bobbing, hovering, and twisting.
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const elapsedTime = clock.getElapsedTime()
      // Animation speeds increased by 32% total (20% + 10%) for a more lively feel
      groupRef.current.position.y = Math.sin(elapsedTime * 0.66) * 0.07

      groupRef.current.rotation.x = -0.28 + Math.sin(elapsedTime * 0.528) * 0.06
      groupRef.current.rotation.y = Math.cos(elapsedTime * 0.396) * 0.08
      groupRef.current.rotation.z = Math.sin(elapsedTime * 0.33) * 0.05
    }
  })

  return (
    // The group maintains the backward tilt for the text.
    <group ref={groupRef} {...props} rotation={[-0.28, 0, 0]}>
      {/* Layer 1: White Stroke - now with a less reflective material */}
      <Center>
        <Text3D
          font={font}
          size={3.05}
          height={0.25}
          bevelEnabled
          bevelSize={0.04}
          bevelThickness={0.04}
          curveSegments={8}
          castShadow
        >
          qloofone
          {/* Use a less shiny material for the stroke to create contrast */}
          <meshStandardMaterial color="#ffffff" roughness={0.8} metalness={0.1} transparent opacity={props.opacity} />
        </Text3D>
      </Center>
      {/* Layer 2: Teal Face - now a more complex physical material */}
      <Center>
        <Text3D
          font={font}
          size={3}
          height={0.3}
          bevelEnabled
          bevelSize={0.03}
          bevelThickness={0.05} // A bit more depth on the bevel
          curveSegments={12} // Smoother curves on the letters
          castShadow
        >
          qloofone
          {/*
            New Simplified Material for Color Consistency
            - We're using meshStandardMaterial for a more predictable satin finish.
            - `roughness` is moderately high (0.4) to create soft, diffuse highlights that don't wash out the color.
            - `metalness` is low, giving it a plastic-like quality rather than a mirror-like one.
            - `emissive` provides a subtle inner glow to ensure the color pops without looking flat.
          */}
          <meshStandardMaterial
            color="#00B8D4"
            roughness={0.4}
            metalness={0.2}
            emissive="#00B8D4"
            emissiveIntensity={0.2}
            transparent
            opacity={props.opacity}
          />
        </Text3D>
      </Center>
    </group>
  )
}

/* ───────────────────── Scene Assembly ───────────────────── */
export function QloofoneLogo() {
  const [scale, setScale] = useState(1)
  const [opacity, setOpacity] = useState(0)
  
  useEffect(() => {
    const checkScale = () => {
      const width = window.innerWidth
      if (width < 640) {
        setScale(1.0)
      } else if (width < 768) {
        setScale(1.0)
      } else {
        setScale(1)
      }
    }
    checkScale()
    window.addEventListener('resize', checkScale)
    return () => window.removeEventListener('resize', checkScale)
  }, [])

  // Fade in animation
  useFrame(() => {
    if (opacity < 1) {
      setOpacity(prev => Math.min(prev + 0.02, 1))
    }
  })

  return (
    <group scale={[scale, scale, scale]}>
      {/* Moved oval further back to prevent any clipping with the text */}
      <OvalRibbon rotation={[Math.PI / 2, 0.06, 0]} position={[0, 0, -0.6]} opacity={opacity} />
      {/* Shifted text further forward on the Z-axis to prevent any clipping. */}
      <Center position={[0, 0, 1.2]}>
        <LogoText opacity={opacity} />
      </Center>
    </group>
  )
}
