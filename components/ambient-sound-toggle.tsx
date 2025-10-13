"use client"

import { useState, useRef, useEffect } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const sounds = [
  { name: "Pássaros", url: "/sounds/birds.mp3" },
  { name: "Floresta", url: "/sounds/forest.mp3" },
  { name: "Oceano", url: "/sounds/ocean.mp3" },
]

export function AmbientSoundToggle() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSound, setCurrentSound] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio()
      audioRef.current.loop = true
      audioRef.current.volume = 0.3
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const toggleSound = (soundUrl: string, soundName: string) => {
    if (!audioRef.current) return

    if (currentSound === soundUrl && isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.src = soundUrl
      audioRef.current.play()
      setIsPlaying(true)
      setCurrentSound(soundUrl)
    }
  }

  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      setIsPlaying(false)
      setCurrentSound(null)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {isPlaying ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {sounds.map((sound) => (
          <DropdownMenuItem
            key={sound.url}
            onClick={() => toggleSound(sound.url, sound.name)}
            className={currentSound === sound.url && isPlaying ? "bg-accent" : ""}
          >
            {sound.name}
          </DropdownMenuItem>
        ))}
        {isPlaying && (
          <DropdownMenuItem onClick={stopSound} className="text-destructive">
            Desligar Som
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
