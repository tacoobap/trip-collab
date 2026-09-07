/**
 * Illustrations of the app for the signed-out landing page.
 *
 * Drawings, not screenshots. The app is behind sign-in, so a real capture
 * would mean an account and somewhere to host the file, and would go stale on
 * the next UI change. These are built from the same palette and proportions as
 * the real surfaces, so they stay honest without needing to be maintained in
 * lockstep.
 *
 * All three are decorative — the copy beside them carries the meaning — so
 * they're hidden from assistive tech rather than described.
 */

/** Stand-ins for cover photos, in the app's own warm palette. */
const PHOTOS = [
  'bg-gradient-to-br from-golden/80 via-coral/60 to-golden/40',
  'bg-gradient-to-br from-sage/80 via-secondary/50 to-sage/30',
  'bg-gradient-to-br from-navy/70 via-accent/50 to-navy/40',
]

/**
 * One table drives both the hour labels and the rules they sit on, so the two
 * can't drift apart the way a stacked gutter does.
 */
const HEADER_H = 68
const GAP = 8
const TIMELINE_H = 150
const HOURS = [
  { label: '9 AM', top: 0 },
  { label: '12 PM', top: 38 },
  { label: '3 PM', top: 76 },
  { label: '6 PM', top: 114 },
]

/**
 * The planning board: days across, hours down, cards sitting at their time.
 */
export function BoardMockup() {
  const days = [
    {
      label: 'Fri 12',
      chips: 2,
      cards: [
        { top: 10, height: 44, tone: 'golden' },
        { top: 96, height: 34, tone: 'sage' },
      ],
    },
    {
      label: 'Sat 13',
      chips: 1,
      cards: [
        { top: 30, height: 34, tone: 'sage' },
        { top: 84, height: 52, tone: 'locked' },
      ],
    },
    {
      label: 'Sun 14',
      chips: 0,
      cards: [
        { top: 4, height: 30, tone: 'locked' },
        { top: 56, height: 40, tone: 'golden' },
        { top: 116, height: 26, tone: 'golden' },
      ],
    },
  ]

  return (
    <div
      aria-hidden
      className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden select-none"
    >
      <div className="flex gap-2 p-3">
        {/* Hour gutter — the labels the grid keeps down its left edge. They're
            positioned against the same rhythm as the rules rather than stacked,
            so a label always sits on its own hour line. */}
        <div className="w-7 shrink-0" style={{ paddingTop: HEADER_H + GAP }}>
          <div className="relative" style={{ height: TIMELINE_H }}>
            {HOURS.map(({ label, top }) => (
              <div
                key={label}
                className="absolute right-1 -translate-y-1/2 text-[8px] leading-none text-muted-foreground"
                style={{ top }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {days.map((day, i) => (
          <div key={day.label} className="flex-1 min-w-0">
            {/* The day header is the photo, with the label on a scrim */}
            <div className={`relative rounded-lg overflow-hidden ${PHOTOS[i]}`}
              style={{ height: HEADER_H }}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              {day.chips > 0 && (
                <div className="absolute top-1.5 left-1.5 right-1.5 flex gap-1">
                  {Array.from({ length: day.chips }).map((_, c) => (
                    <div
                      key={c}
                      className="h-2 flex-1 max-w-[38px] rounded-full bg-white/75"
                    />
                  ))}
                </div>
              )}
              <div className="absolute bottom-1.5 left-2 text-[9px] font-medium text-white">
                {day.label}
              </div>
            </div>

            {/* The timeline, with hour rules behind the cards */}
            <div
              className="relative rounded-lg bg-muted/30"
              style={{ marginTop: GAP, height: TIMELINE_H }}
            >
              {HOURS.map(({ top }) => (
                <div
                  key={top}
                  className="absolute inset-x-0 h-px bg-foreground/10"
                  style={{ top }}
                />
              ))}
              {day.cards.map((card) => (
                <div
                  key={card.top}
                  className={`absolute inset-x-1 rounded-md border-l-[3px] shadow-sm ${
                    card.tone === 'golden'
                      ? 'bg-golden/30 border-golden'
                      : card.tone === 'sage'
                        ? 'bg-sage/35 border-sage'
                        : 'bg-locked/25 border-locked'
                  }`}
                  style={{ top: card.top, height: card.height }}
                >
                  <div className="mt-1.5 ml-1.5 h-1 w-8 rounded-full bg-foreground/25" />
                  {card.height > 24 && (
                    <div className="mt-1 ml-1.5 h-1 w-5 rounded-full bg-foreground/15" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The collection: everyone's ideas as cards, with likes to sort the wheat.
 */
export function CollectionMockup() {
  const items = [
    { photo: 0, likes: 3, liked: true },
    { photo: 1, likes: 1, liked: false },
    { photo: 2, likes: 4, liked: true },
    { photo: 1, likes: 0, liked: false },
  ]

  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 select-none">
      {items.map((item, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card shadow-sm overflow-hidden"
        >
          <div className={`h-16 ${PHOTOS[item.photo]}`} />
          <div className="p-2.5 space-y-1.5">
            <div className="h-1.5 w-3/4 rounded-full bg-foreground/25" />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
            <div className="flex items-center gap-1 pt-0.5">
              <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 shrink-0">
                <path
                  d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6.5 5.3 5.3 0 0 1 21.3 12c-2.3 4.4-9.3 9-9.3 9Z"
                  className={item.liked ? 'fill-coral' : 'fill-none stroke-muted-foreground'}
                  strokeWidth={2}
                />
              </svg>
              <span className="text-[8px] leading-none text-muted-foreground">{item.likes}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * The finished itinerary, and the one link that shares it.
 */
export function ShareMockup() {
  const days = [
    { label: 'Day 1', rows: [{ time: '9:30', w: 'w-full' }, { time: '1 PM', w: 'w-4/5' }] },
    { label: 'Day 2', rows: [{ time: '10 AM', w: 'w-5/6' }, { time: '7 PM', w: 'w-3/5' }] },
    { label: 'Day 3', rows: [{ time: '11 AM', w: 'w-2/3' }] },
  ]

  return (
    <div aria-hidden className="select-none space-y-3">
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className={`relative h-24 ${PHOTOS[1]}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-2.5 left-3.5 space-y-1.5">
            <div className="h-2.5 w-28 rounded-full bg-white/90" />
            <div className="h-1.5 w-20 rounded-full bg-white/60" />
          </div>
        </div>
        <div className="divide-y divide-border">
          {days.map((day) => (
            <div key={day.label} className="flex gap-3 px-3.5 py-3">
              <div className="w-8 shrink-0 pt-0.5 text-[8px] leading-none font-medium text-foreground/70">
                {day.label}
              </div>
              <div className="flex-1 space-y-2">
                {day.rows.map((row) => (
                  <div key={row.time} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 text-[8px] leading-none text-muted-foreground">
                      {row.time}
                    </span>
                    <span className={`h-1.5 rounded-full bg-foreground/20 ${row.w}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* The link, as it lands in a chat */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2">
        <div className="h-2 w-2 rounded-full bg-success shrink-0" />
        <div className="h-1.5 flex-1 rounded-full bg-foreground/20" />
        <div className="text-[8px] leading-none text-muted-foreground shrink-0">Copied</div>
      </div>
    </div>
  )
}
