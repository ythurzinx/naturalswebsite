"use client"

import { Button } from "@/components/ui/button"

interface CategoryFilterProps {
  categories: string[]
  selectedCategory: string | null
  onSelectCategory: (category: string | null) => void
}

export function CategoryFilter({ categories, selectedCategory, onSelectCategory }: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={selectedCategory === null ? "default" : "outline"}
        onClick={() => onSelectCategory(null)}
        className="rounded-full"
      >
        Todos
      </Button>
      {categories.map((category) => (
        <Button
          key={category}
          variant={selectedCategory === category ? "default" : "outline"}
          onClick={() => onSelectCategory(category)}
          className="rounded-full"
        >
          {category}
        </Button>
      ))}
    </div>
  )
}
