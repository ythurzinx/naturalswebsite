import { Card, CardContent, CardFooter } from "@/components/ui/card"

export function ProductSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="aspect-square bg-muted rounded-lg mb-4 animate-pulse" />
        <div className="space-y-3">
          <div className="h-5 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/3" />
          <div className="h-8 bg-muted rounded animate-pulse w-1/2 mt-4" />
        </div>
      </CardContent>
      <CardFooter className="p-6 pt-0">
        <div className="w-full space-y-3">
          <div className="h-10 bg-muted rounded animate-pulse" />
          <div className="h-12 bg-muted rounded animate-pulse" />
        </div>
      </CardFooter>
    </Card>
  )
}
