import { cn } from '@/lib/utils'

interface CityTagProps {
  city: string
  className?: string
}

const CITY_COLORS: Record<string, string> = {
  Paris: 'bg-navy/10 text-navy border-navy/20',
  London: 'bg-sage/10 text-sage border-sage/20',
}

export function CityTag({ city, className }: CityTagProps) {
  const colorClass = CITY_COLORS[city] ?? 'bg-muted text-muted-foreground border-border'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        colorClass,
        className
      )}
    >
      {city}
    </span>
  )
}
