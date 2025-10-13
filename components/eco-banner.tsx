import { Sprout } from "lucide-react"

export function EcoBanner() {
  return (
    <div className="bg-gradient-to-r from-primary/10 via-secondary/20 to-primary/10 border-y border-primary/20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-3 text-center">
          <Sprout className="h-6 w-6 text-primary flex-shrink-0" />
          <p className="text-sm md:text-base font-medium text-balance">
            Cada compra apoia programas de reflorestamento no Brasil 🌳
          </p>
          <Sprout className="h-6 w-6 text-primary flex-shrink-0" />
        </div>
      </div>
    </div>
  )
}
