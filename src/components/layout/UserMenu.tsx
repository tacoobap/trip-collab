import { useRef, useState, useEffect } from 'react'
import { ChevronDown, LogOut } from 'lucide-react'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useDisplayName } from '@/hooks/useDisplayName'

interface UserMenuProps {
  /** When true, use dark styling (e.g. over hero) */
  isDark?: boolean
}

export function UserMenu({ isDark = false }: UserMenuProps) {
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
        title="Account menu"
        aria-label="Account menu"
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
            'absolute right-0 top-full mt-1 min-w-[10rem] rounded-lg border py-1 shadow-lg z-30',
            isDark
              ? 'border-white/20 bg-black/90 backdrop-blur-md text-white'
              : 'border-border bg-warm-white shadow-md'
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false)
              signOut()
            }}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
              isDark ? 'hover:bg-white/15' : 'hover:bg-muted text-foreground'
            )}
          >
            <LogOut className="w-4 h-4 shrink-0 opacity-70" />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
