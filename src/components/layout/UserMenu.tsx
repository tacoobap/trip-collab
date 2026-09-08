import { useRef, useState, useEffect } from 'react'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useDisplayName } from '@/hooks/useDisplayName'

export interface MenuItem {
  label: string
  Icon: LucideIcon
  onSelect: () => void
}

interface UserMenuProps {
  /** When true, use dark styling (e.g. over hero) */
  isDark?: boolean
  /** Trip slug — when set, the menu offers that trip's controls. */
  tripSlug?: string
  /** Trip name, shown as the group heading so the menu's scope reads. */
  tripName?: string
  /**
   * Trip-wide actions shown **only below `sm`** — To-dos and Stays. Above that
   * they are buttons in the header, which hide themselves on phones, so these
   * are offered exactly once at any width.
   */
  phoneActions?: MenuItem[]
}

/**
 * Account and trip menu. Deliberately shallow: everything you administer about
 * a trip — its name, dates, destinations, and both of its links — lives on the
 * settings page rather than being scattered across menu items, so this only has
 * to point at one door. Off a trip (`/home`) the heading and the settings link
 * are absent, leaving just Sign out.
 */
export function UserMenu({
  isDark = false,
  tripSlug,
  tripName,
  phoneActions = [],
}: UserMenuProps) {
  const { user, signOut } = useAuth()
  const { displayName } = useDisplayName()
  const [menuOpen, setMenuOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const nameBtn = isDark ? 'text-white/80 hover:text-white' : 'text-muted-foreground hover:text-foreground'

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])


  if (!user || !displayName) return null

  const itemClass = cn(
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
    isDark ? 'hover:bg-white/15' : 'hover:bg-muted text-foreground'
  )

  return (
    <div className="relative flex items-center shrink-0 max-sm:min-h-[44px] max-sm:items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1.5 transition-colors group touch-manipulation max-sm:p-2 max-sm:-m-2 rounded-md',
          nameBtn
        )}
        title="Menu"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-haspopup="true"
      >
        <ProposerAvatar name={displayName} size="sm" />
        <ChevronDown
          className={cn(
            'w-3 h-3 opacity-50 group-hover:opacity-100 transition-transform',
            isDark ? 'text-white' : '',
            menuOpen && 'rotate-180'
          )}
        />
      </button>
      {menuOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-1 min-w-[12rem] rounded-lg border py-1 shadow-lg z-30',
            isDark
              ? 'border-white/20 bg-black/90 backdrop-blur-md text-white'
              : 'border-border bg-warm-white shadow-md'
          )}
        >
          {tripSlug && (
            <>
              {tripName && (
                <p
                  className={cn(
                    'px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider truncate',
                    isDark ? 'text-white/50' : 'text-muted-foreground'
                  )}
                >
                  {tripName}
                </p>
              )}
              {phoneActions.map(({ label, Icon, onSelect }) => (
                <button
                  key={label}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onSelect()
                  }}
                  className={cn(itemClass, 'sm:hidden')}
                >
                  <Icon className="w-4 h-4 shrink-0 opacity-70" />
                  {label}
                </button>
              ))}
              <Link
                to={`/trip/${tripSlug}/settings`}
                role="menuitem"
                onClick={() => setMenuOpen(false)}
                className={itemClass}
              >
                <Settings className="w-4 h-4 shrink-0 opacity-70" />
                Trip settings
              </Link>
              <div className={cn('my-1 h-px', isDark ? 'bg-white/20' : 'bg-border')} />
            </>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              signOut()
            }}
            className={itemClass}
          >
            <LogOut className="w-4 h-4 shrink-0 opacity-70" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
