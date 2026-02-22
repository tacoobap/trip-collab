import { CityTag } from '@/components/shared/CityTag'

interface CityDividerProps {
  city: string
  dayRange?: string
}

export function CityDivider({ city, dayRange }: CityDividerProps) {
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="flex-1 h-px bg-border" />
      <div className="flex items-center gap-2 shrink-0">
        <CityTag city={city} />
        {dayRange && (
          <span className="text-xs text-muted-foreground">{dayRange}</span>
        )}
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  )
}
