export function Card({ children }: { children: React.ReactNode }) {
  return <div className="border rounded-lg p-4 shadow-sm">{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-semibold">{children}</div>
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold">{children}</h2>
}

export function CardContent({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>
}
