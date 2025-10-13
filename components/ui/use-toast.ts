type ToastOptions = {
  title: string
  description?: string
  variant?: "default" | "destructive"
}

export function toast({ title, description, variant }: ToastOptions) {
  console.log(`[TOAST ${variant?.toUpperCase() || "DEFAULT"}] ${title}: ${description || ""}`)
}
