import type { DayWithSlots } from '@/types/database'

export type UpdateTextSelections = {
  vibe: boolean
  dayDescriptions: boolean
  activityDescriptions: boolean
}

interface UpdateTextModalProps {
  open: boolean
  onClose: () => void
  selections: UpdateTextSelections
  onSelectionsChange: (next: UpdateTextSelections) => void
  dayScopeMode: 'all' | 'selected'
  onDayScopeModeChange: (mode: 'all' | 'selected') => void
  selectedDayIds: string[]
  onSelectedDayIdsChange: (ids: string[]) => void
  days: DayWithSlots[]
  onUpdate: (
    selections: UpdateTextSelections,
    dayScope: { mode: 'all' | 'selected'; selectedDayIds: string[] }
  ) => void
  disabled: boolean
}

export function UpdateTextModal({
  open,
  onClose,
  selections,
  onSelectionsChange,
  dayScopeMode,
  onDayScopeModeChange,
  selectedDayIds,
  onSelectedDayIdsChange,
  days,
  onUpdate,
  disabled,
}: UpdateTextModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-xl max-w-sm w-full p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-3">Update text</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Choose which parts to regenerate:
        </p>
        <div className="space-y-2 mb-4">
          {(
            [
              { key: 'vibe' as const, label: 'Vibe' },
              { key: 'dayDescriptions' as const, label: 'Day descriptions' },
              { key: 'activityDescriptions' as const, label: 'Activity descriptions' },
            ] as const
          ).map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer text-sm text-foreground"
            >
              <input
                type="checkbox"
                checked={selections[key]}
                onChange={(e) =>
                  onSelectionsChange({ ...selections, [key]: e.target.checked })
                }
                className="rounded border-border"
              />
              {label}
            </label>
          ))}
        </div>

        {(selections.dayDescriptions || selections.activityDescriptions) &&
          days.length > 0 && (
            <div className="mb-6 pt-3 border-t border-border">
              <p className="text-xs font-medium text-foreground mb-2">Apply to:</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="radio"
                    name="dayScope"
                    checked={dayScopeMode === 'all'}
                    onChange={() => onDayScopeModeChange('all')}
                    className="border-border"
                  />
                  Whole trip
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <input
                    type="radio"
                    name="dayScope"
                    checked={dayScopeMode === 'selected'}
                    onChange={() => onDayScopeModeChange('selected')}
                    className="border-border"
                  />
                  Selected days
                </label>
                {dayScopeMode === 'selected' && (
                  <div className="ml-5 mt-1 space-y-1.5">
                    {days.map((day) => (
                      <label
                        key={day.id}
                        className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDayIds.includes(day.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              onSelectedDayIdsChange([...selectedDayIds, day.id])
                            } else {
                              onSelectedDayIdsChange(
                                selectedDayIds.filter((id) => id !== day.id)
                              )
                            }
                          }}
                          className="rounded border-border"
                        />
                        {day.narrative_title || day.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate(selections, {
                mode: dayScopeMode,
                selectedDayIds,
              })
            }
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 border border-primary rounded-md disabled:opacity-50 disabled:pointer-events-none"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}
