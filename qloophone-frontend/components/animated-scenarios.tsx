"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Scenario {
  id: number
  left: string
  right: string
  result: string
}

const scenarios: Scenario[] = [
  // Perfect opposites with clear bridges
  {
    id: 1,
    left: 'Star Wars',
    right: 'Pride & Prejudice',
    result: "The Princess Bride"
  },
  {
    id: 2,
    left: 'The Godfather',
    right: 'Mean Girls',
    result: "Succession"
  },
  {
    id: 3,
    left: 'Frozen',
    right: 'The Dark Knight',
    result: "Once Upon a Time"
  },
  {
    id: 4,
    left: 'The Notebook',
    right: 'Mad Max',
    result: "Outlander"
  },
  // TV bridges
  {
    id: 5,
    left: 'The Office',
    right: 'Breaking Bad',
    result: "Better Call Saul"
  },
  {
    id: 6,
    left: 'Friends',
    right: 'Game of Thrones',
    result: "How I Met Your Mother"
  },
  {
    id: 7,
    left: 'Stranger Things',
    right: 'Minecraft',
    result: "The Nevers"
  },
  // Music taste bridges
  {
    id: 8,
    left: 'Taylor Swift',
    right: 'The Weeknd',
    result: "Ariana Grande"
  },
  {
    id: 9,
    left: 'Billie Eilish',
    right: 'Post Malone',
    result: "Doja Cat"
  },
  {
    id: 10,
    left: 'Metallica',
    right: 'Taylor Swift',
    result: "Paramore"
  },
  {
    id: 11,
    left: 'Drake',
    right: 'Ed Sheeran',
    result: "Justin Bieber"
  },
  // Cross-media magic
  {
    id: 12,
    left: 'Harry Potter',
    right: 'Lord of the Rings',
    result: "The Magicians"
  },
  {
    id: 13,
    left: 'The Witcher',
    right: 'Skyrim',
    result: "His Dark Materials"
  },
  {
    id: 14,
    left: 'Marvel',
    right: 'DC Comics',
    result: "The Boys"
  },
  // Gaming bridges
  {
    id: 15,
    left: 'Call of Duty',
    right: 'Animal Crossing',
    result: "Stardew Valley"
  },
  {
    id: 16,
    left: 'Fortnite',
    right: 'Minecraft',
    result: "Roblox"
  },
  // Brand lifestyle matches
  {
    id: 17,
    left: 'Nike',
    right: 'Lululemon',
    result: "Athleta"
  },
  {
    id: 18,
    left: 'Apple',
    right: 'Tesla',
    result: "Google"
  },
  {
    id: 19,
    left: 'Starbucks',
    right: 'WeWork',
    result: "Blue Bottle Coffee"
  },
  // Food bridges
  {
    id: 20,
    left: 'McDonald\'s',
    right: 'Whole Foods',
    result: "Chipotle"
  },
  {
    id: 21,
    left: 'Taco Bell',
    right: 'Sweetgreen',
    result: "Qdoba"
  },
  // Podcast variety
  {
    id: 22,
    left: 'Serial',
    right: 'Comedy Bang Bang',
    result: "This American Life"
  },
  // Travel destinations
  {
    id: 23,
    left: 'Paris',
    right: 'Tokyo',
    result: "Montreal"
  },
  {
    id: 24,
    left: 'Hawaii',
    right: 'Iceland',
    result: "New Zealand"
  },
  // Book adaptations
  {
    id: 25,
    left: 'The Hunger Games',
    right: '1984',
    result: "Black Mirror"
  },
  // Classic with modern twist
  {
    id: 26,
    left: 'James Bond',
    right: 'Jason Bourne',
    result: "Mission Impossible"
  },
  {
    id: 27,
    left: 'Mad Men',
    right: 'Silicon Valley',
    result: "Suits"
  },
  {
    id: 28,
    left: 'The Crown',
    right: 'House of Cards',
    result: "Succession"
  },
  // Cross-entity magic
  {
    id: 29,
    left: 'Nike',
    right: 'The Last Dance',
    result: "Space Jam"
  },
  {
    id: 30,
    left: 'Starbucks',
    right: 'Friends',
    result: "Central Perk Cafe"
  },
  {
    id: 31,
    left: 'Marvel',
    right: 'Stranger Things',
    result: "The Umbrella Academy"
  },
  {
    id: 32,
    left: 'Harry Potter',
    right: 'Universal Studios',
    result: "Fantastic Beasts"
  },
  {
    id: 33,
    left: 'Gordon Ramsay',
    right: 'Netflix',
    result: "Chef's Table"
  },
  {
    id: 34,
    left: 'Paris',
    right: 'Emily in Paris',
    result: "Chanel"
  },
  {
    id: 35,
    left: 'The Office',
    right: 'Spotify',
    result: "Office Ladies Podcast"
  },
  {
    id: 36,
    left: 'Serial',
    right: 'HBO',
    result: "The Jinx"
  },
  {
    id: 37,
    left: 'Fortnite',
    right: 'Travis Scott',
    result: "Ready Player One"
  },
  {
    id: 38,
    left: 'Star Wars',
    right: 'Fortnite',
    result: "Razer"
  },
  {
    id: 39,
    left: 'The Beatles',
    right: 'Liverpool',
    result: "The Cavern Club"
  },
]

export function AnimatedScenarios() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [animationPhase, setAnimationPhase] = useState<'left' | 'right' | 'result' | 'hold' | 'fadeout'>('left')

  useEffect(() => {
    // Animation timeline
    const runAnimation = () => {
      // Reset to start
      setAnimationPhase('left')
      
      // 0.7s - Show right item and +
      setTimeout(() => setAnimationPhase('right'), 700)
      
      // 1.4s - Show result with = 
      setTimeout(() => setAnimationPhase('result'), 1400)
      
      // 2.2s - Hold result
      setTimeout(() => setAnimationPhase('hold'), 2200)
      
      // 3.5s - Fade out
      setTimeout(() => {
        setAnimationPhase('fadeout')
        // 3.8s - Move to next scenario
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % scenarios.length)
          setAnimationPhase('left')
        }, 300)
      }, 3500)
    }

    // Start first animation
    runAnimation()
    
    // Set up interval for subsequent animations
    const timer = setInterval(runAnimation, 3800)

    return () => clearInterval(timer)
  }, [])

  const current = scenarios[currentIndex]

  return (
    <div className="w-full max-w-[95vw] sm:max-w-3xl md:max-w-5xl mx-auto h-48 sm:h-32 md:h-20 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: animationPhase === 'fadeout' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="text-center w-full"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-1 md:gap-6">
            {/* Left item */}
            <motion.div
              className="relative group"
              initial={{ opacity: 0, x: -30 }}
              animate={{ 
                opacity: animationPhase !== 'fadeout' ? 1 : 0,
                x: animationPhase !== 'fadeout' ? 0 : -30
              }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="absolute inset-0 bg-accent1/10 blur-xl group-hover:bg-accent1/20 transition-all duration-300" />
              <div className="relative bg-white/5 backdrop-blur-sm px-4 sm:px-5 md:px-6 py-2 sm:py-3 rounded-lg border border-white/10 group-hover:border-accent1/50 transition-all duration-300">
                <span className="font-mono text-lg sm:text-xl md:text-2xl text-gray-200 tracking-tight">{current.left}</span>
              </div>
            </motion.div>

            {/* Plus sign */}
            <motion.span 
              className="font-mono text-xl sm:text-2xl md:text-3xl font-bold text-accent2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: ['right', 'result', 'hold'].includes(animationPhase) ? 1 : 0,
                scale: ['right', 'result', 'hold'].includes(animationPhase) ? 1 : 0.5
              }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              style={{
                textShadow: ['right', 'result', 'hold'].includes(animationPhase) 
                  ? '0 0 20px rgba(255, 41, 117, 0.8)' 
                  : 'none'
              }}
            >
              +
            </motion.span>

            {/* Right item */}
            <motion.div
              className="relative group"
              initial={{ opacity: 0, x: 30 }}
              animate={{ 
                opacity: ['right', 'result', 'hold'].includes(animationPhase) ? 1 : 0,
                x: ['right', 'result', 'hold'].includes(animationPhase) ? 0 : 30
              }}
              transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <div className="absolute inset-0 bg-accent1/10 blur-xl group-hover:bg-accent1/20 transition-all duration-300" />
              <div className="relative bg-white/5 backdrop-blur-sm px-4 sm:px-5 md:px-6 py-2 sm:py-3 rounded-lg border border-white/10 group-hover:border-accent1/50 transition-all duration-300">
                <span className="font-mono text-lg sm:text-xl md:text-2xl text-gray-200 tracking-tight">{current.right}</span>
              </div>
            </motion.div>

            {/* Equals sign */}
            <motion.span 
              className="font-mono text-xl sm:text-2xl md:text-3xl font-bold text-accent2"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: ['result', 'hold'].includes(animationPhase) ? 1 : 0,
                scale: ['result', 'hold'].includes(animationPhase) ? 1 : 0.5
              }}
              transition={{ duration: 0.2, type: "spring", stiffness: 300, damping: 20 }}
              style={{
                textShadow: ['result', 'hold'].includes(animationPhase) 
                  ? '0 0 20px rgba(255, 41, 117, 0.8)' 
                  : 'none'
              }}
            >
              =
            </motion.span>

            {/* Result */}
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ 
                opacity: ['result', 'hold'].includes(animationPhase) ? 1 : 0,
                scale: ['result', 'hold'].includes(animationPhase) ? 1 : 0.7,
                y: ['result', 'hold'].includes(animationPhase) ? 0 : 10
              }}
              transition={{ 
                duration: 0.3,
                type: "spring",
                stiffness: 260,
                damping: 20
              }}
            >
              <span 
                className="relative inline-block font-mono text-xl sm:text-2xl md:text-3xl font-bold tracking-tight sm:tracking-normal md:tracking-wide"
                style={{
                  color: ['result', 'hold'].includes(animationPhase) ? '#FFC247' : '#e0e0e0',
                  background: 'transparent',
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  textShadow: ['result', 'hold'].includes(animationPhase) 
                    ? `
                      0 0 8px rgba(255, 194, 71, 0.9),
                      0 0 16px rgba(255, 194, 71, 0.7),
                      0 0 24px rgba(255, 194, 71, 0.5),
                      0 0 32px rgba(255, 194, 71, 0.3)
                    ` 
                    : 'none'
                }}
              >
                {current.result}
              </span>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}