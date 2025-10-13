"use client"

import { useEffect, useState } from "react"

interface Leaf {
  id: number
  left: number
  delay: number
  duration: number
}

export function AnimatedLeaves() {
  const [leaves, setLeaves] = useState<Leaf[]>([])

  useEffect(() => {
    const newLeaves = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 10,
    }))
    setLeaves(newLeaves)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {leaves.map((leaf) => (
        <div
          key={leaf.id}
          className="absolute -top-10 animate-float opacity-30"
          style={{
            left: `${leaf.left}%`,
            animationDelay: `${leaf.delay}s`,
            animationDuration: `${leaf.duration}s`,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="text-primary"
          >
            <path
              d="M12 2C12 2 7 4 7 12C7 16 9 18 12 22C15 18 17 16 17 12C17 4 12 2 12 2Z"
              fill="currentColor"
              opacity="0.6"
            />
          </svg>
        </div>
      ))}
    </div>
  )
}
