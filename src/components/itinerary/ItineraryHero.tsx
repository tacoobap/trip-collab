import { motion } from 'framer-motion'
import type { Trip } from '@/types/database'

interface ItineraryHeroProps {
  trip: Trip
  /** Current hero image URL (preview blob, uploaded URL, or trip.image_url). */
  currentHero: string | null
  /** Ref attached to the hero container for scroll detection. */
  heroRef: React.RefObject<HTMLDivElement | null>
  /** Formatted date range string, e.g. "March 1 – March 5". */
  dateRange: string | null
}

export function ItineraryHero({
  trip,
  currentHero,
  heroRef,
  dateRange,
}: ItineraryHeroProps) {
  return (
    <div
      ref={heroRef}
      className="relative min-h-screen h-[100vh] overflow-hidden bg-gradient-to-br from-navy/80 via-sage/50 to-golden/40"
    >
      {currentHero && (
        <motion.img
          src={currentHero}
          alt={trip.name}
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1 }}
          animate={{ scale: 1.08 }}
          transition={{
            duration: 20,
            ease: 'linear',
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/5" />
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, hsl(var(--background)), transparent)',
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-12">
        <div className="text-center max-w-2xl">
          <motion.h1
            className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal text-white leading-tight tracking-tight mb-4"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            {trip.name}
          </motion.h1>
          {trip.tagline && (
            <motion.p
              className="font-serif text-xs sm:text-sm md:text-base text-white/65 italic font-normal tracking-wide mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.45 }}
            >
              {trip.tagline}
            </motion.p>
          )}
          {(trip.destinations.length > 0 || dateRange) && (
            <motion.div
              className="w-12 h-px bg-primary/80 mx-auto my-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            />
          )}
          {trip.destinations.length > 0 && (
            <motion.p
              className="text-white/80 text-base sm:text-lg font-sans font-light tracking-wide mb-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.45 }}
            >
              {trip.destinations.join(' · ')}
            </motion.p>
          )}
          {dateRange && (
            <motion.p
              className="text-white/60 text-sm font-sans font-light"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.45 }}
            >
              {dateRange}
            </motion.p>
          )}
        </div>
      </div>
    </div>
  )
}
