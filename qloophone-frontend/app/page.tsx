"use client"

import type React from "react"
import { useEffect, useState } from "react"
import * as THREE from "three"
import { AnimatedScenarios } from "@/components/animated-scenarios"
import { QloofoneLogo } from "@/components/qloofone-logo"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment } from "@react-three/drei"

export default function QloofoneLandingPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [showScenarios, setShowScenarios] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowScenarios(true)
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  return (
    // The main container with the charcoal background and font settings.
    // The CRT scanline effect is applied via globals.css.
    <div className="bg-charcoal text-gray-200 min-h-dvh font-sans">
      <main className="relative z-10">
        {/* Hero Section: Full viewport height, centered content */}
        <section className="h-dvh min-h-[600px] md:min-h-[700px] flex flex-col items-center justify-between text-center p-4 pt-[3vh] md:pt-[6vh] overflow-hidden">
          {/* Content wrapper with proper spacing */}
          <div className="flex flex-col items-center justify-start w-full pt-[5vh] md:pt-0 gap-16 sm:gap-8 md:gap-12">
            {/* Enlarged Logo Container, now the primary visual anchor */}
            <div className="h-40 sm:h-56 md:h-80 w-full mx-auto group flex-shrink-0 md:-mb-8">
            <Canvas
              camera={{ 
                position: isMobile ? [0, 5.5, 12] : [0, 5.5, 17], 
                fov: isMobile ? 40 : 38 
              }}
              gl={{ antialias: true, toneMapping: THREE.NoToneMapping }}
              shadows
            >
              {/* 
              New Lighting Setup for a Dynamic, High-Quality Retro Feel
            */}
              {/* 1. Environment for realistic reflections on the metallic surfaces */}
              <Environment preset="studio" intensity={0.4} />

              {/* 2. Key Light (main light source) */}
              <directionalLight
                castShadow // This light will cast shadows
                position={[10, 10, 10]}
                intensity={1.2}
                shadow-mapSize-width={1024} // Shadow map resolution
                shadow-mapSize-height={1024}
                shadow-camera-far={30}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />

              {/* 3. Fill Light (softens shadows) */}
              <directionalLight position={[-10, 5, -10]} intensity={0.2} />

              {/* 4. Rim Light (creates edge highlights for drama) */}
              <pointLight position={[0, 0, -15]} intensity={1.0} color="#00B8D4" />

              <QloofoneLogo />

              <OrbitControls enabled={false} />
            </Canvas>
            </div>

            {/* The headline has been removed to reduce visual competition. */}

            {/* Phone number container with flexible height */}
            <div className="flex-shrink-0">
              <a
                href="tel:1-877-361-7566"
                aria-label="Dial 877-361-7566"
                className="font-mono text-4xl sm:text-5xl md:text-7xl font-bold tracking-wider md:tracking-widest text-accent2 rounded-lg transition-all duration-400 ease-custom-ease drop-shadow-[0_0_8px_var(--clr-accent2)] hover:drop-shadow-[0_0_20px_var(--clr-accent2)] inline-block"
                // CSS variable passed for the glow color
                style={{ "--clr-accent2": "rgba(255, 41, 117, 0.8)" } as React.CSSProperties}
              >
                877-361-7566
              </a>
            </div>

            {/* Animated Scenarios Component, showcasing cultural combinations */}
            <div className="w-full px-2 sm:px-4 flex-shrink-0">
              {showScenarios && <AnimatedScenarios />}
            </div>
          </div>
          
          {/* Footer Section - moved inside hero section */}
          <div className="pb-4">
            <p className="text-gray-500 text-[10px] tracking-wide max-w-xs mx-auto">
              Unofficial hackathon prototype — powered by Qloo.
            </p>
          </div>
        </section>

      </main>
    </div>
  )
}
