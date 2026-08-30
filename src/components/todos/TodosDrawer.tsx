import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  CalendarDays,
  ChevronDown,
  GripVertical,
  ListChecks,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ProposerAvatar } from '@/components/shared/ProposerAvatar'
import { useDragReorder } from '@/hooks/useDragReorder'
import type { TripTodo } from '@/types/database'
import type { UpdateTodoInput } from '@/services/todoService'
import { cn, formatTripDate } from '@/lib/utils'

/** Local-midnight YYYY-MM-DD, so "overdue" matches the user's calendar day. */
function todayIso(): string {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

function dueLabel(due: string, today: string): { text: string; overdue: boolean } {
  if (due < today) return { text: formatTripDate(due) ?? due, overdue: true }
  if (due === today) return { text: 'Today', overdue: false }
  const tomorrow = new Date(`${today}T00:00:00`)
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (due === tomorrow.toISOString().slice(0, 10)) {
    return { text: 'Tomorrow', overdue: false }
  }
  return { text: formatTripDate(due) ?? due, overdue: false }
}

interface CheckboxProps {
  done: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}

function TodoCheckbox({ done, disabled, onToggle, label }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
        done
          ? 'bg-primary border-primary text-primary-foreground'
          : 'border-input bg-background hover:border-primary/60',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
    </button>
  )
}

interface TodoEditorProps {
  todo: TripTodo
  people: string[]
  onSave: (data: UpdateTodoInput) => Promise<void>
  onDelete: () => void
  onCancel: () => void
}

function TodoEditor({ todo, people, onSave, onDelete, onCancel }: TodoEditorProps) {
  const [text, setText] = useState(todo.text)
  const [assignee, setAssignee] = useState<string | null>(todo.assigned_to)
  const [due, setDue] = useState(todo.due_date ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const trimmed = text.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await onSave({
        text: trimmed,
        assigned_to: assignee,
        due_date: due || null,
      })
    } catch {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-muted/40 p-3 space-y-3">
      <Input
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void handleSave()
          }
          if (e.key === 'Escape') onCancel()
        }}
        className="text-sm"
      />

      <div>
        <p className="text-xs font-medium text-foreground mb-1.5">Assigned to</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setAssignee(null)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-all',
              assignee === null
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-dashed border-border hover:border-primary/40'
            )}
          >
            Anyone
          </button>
          {people.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setAssignee(name)}
              className={cn(
                'flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-xs font-medium border transition-all',
                assignee === name
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-foreground border-border hover:border-primary/40'
              )}
            >
              <ProposerAvatar name={name} size="xs" />
              {name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-foreground mb-1.5">Due date</p>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="text-sm flex-1"
          />
          {due && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDue('')}>
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving || !text.trim()}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

interface TodoRowProps {
  todo: TripTodo
  today: string
  canEdit: boolean
  dragging: boolean
  onToggle: () => void
  onOpenEditor: () => void
  handleProps?: React.HTMLAttributes<HTMLElement> & { style: React.CSSProperties }
}

function TodoRow({
  todo,
  today,
  canEdit,
  dragging,
  onToggle,
  onOpenEditor,
  handleProps,
}: TodoRowProps) {
  const due = todo.due_date ? dueLabel(todo.due_date, today) : null
  const hasMeta = !!todo.assigned_to || !!due

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-xl border bg-card px-2 py-2.5 transition-shadow',
        dragging ? 'border-primary/50 shadow-lg' : 'border-border'
      )}
    >
      {canEdit && handleProps && (
        <button
          type="button"
          aria-label={`Reorder ${todo.text}. Use arrow keys to move.`}
          className="shrink-0 -ml-0.5 p-1 rounded text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...handleProps}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      )}

      <div className="pt-0.5">
        <TodoCheckbox
          done={todo.done}
          disabled={!canEdit}
          onToggle={onToggle}
          label={todo.done ? `Mark "${todo.text}" as not done` : `Mark "${todo.text}" as done`}
        />
      </div>

      <button
        type="button"
        disabled={!canEdit}
        onClick={onOpenEditor}
        className="min-w-0 flex-1 text-left disabled:cursor-default"
      >
        <span
          className={cn(
            'block text-sm leading-snug break-words',
            todo.done ? 'text-muted-foreground line-through' : 'text-foreground'
          )}
        >
          {todo.text}
        </span>
        {hasMeta && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {todo.assigned_to && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <ProposerAvatar name={todo.assigned_to} size="xs" />
                {todo.assigned_to}
              </span>
            )}
            {due && (
              <span
                className={cn(
                  'flex items-center gap-1 text-xs',
                  due.overdue && !todo.done
                    ? 'text-destructive font-medium'
                    : 'text-muted-foreground'
                )}
              >
                <CalendarDays className="w-3 h-3" />
                {due.text}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  )
}

interface TodosDrawerProps {
  open: boolean
  onClose: () => void
  openTodos: TripTodo[]
  doneTodos: TripTodo[]
  currentName: string | null
  /** Names seen elsewhere on this trip, offered in the assignee picker. */
  travelers: string[]
  onAdd: (text: string) => Promise<void>
  onUpdate: (todoId: string, data: UpdateTodoInput) => Promise<void>
  onToggle: (todoId: string, done: boolean) => Promise<void>
  onDelete: (todoId: string) => Promise<void>
  onReorder: (orderedIds: string[]) => Promise<void>
  onClearDone: () => Promise<void>
  canEdit?: boolean
}

export function TodosDrawer({
  open,
  onClose,
  openTodos,
  doneTodos,
  currentName,
  travelers,
  onAdd,
  onUpdate,
  onToggle,
  onDelete,
  onReorder,
  onClearDone,
  canEdit = true,
}: TodosDrawerProps) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const today = todayIso()

  const openIds = useMemo(() => openTodos.map((t) => t.id), [openTodos])

  const { registerRow, getRowOffset, handleProps, activeIndex, isDragging, scrollRef } =
    useDragReorder({
      ids: openIds,
      onCommit: (ordered) => void onReorder(ordered),
      disabled: !canEdit,
    })

  // Row heights are measured when a drag begins, so an expanded editor mid-list
  // would throw the offsets off. Collapse it as soon as a drag starts.
  useEffect(() => {
    if (isDragging) setEditingId(null)
  }, [isDragging])

  const people = useMemo(() => {
    const names = new Set<string>()
    if (currentName) names.add(currentName)
    travelers.forEach((n) => n && names.add(n))
    ;[...openTodos, ...doneTodos].forEach((t) => {
      if (t.assigned_to) names.add(t.assigned_to)
      if (t.created_by) names.add(t.created_by)
    })
    return [...names]
  }, [currentName, travelers, openTodos, doneTodos])

  const handleAdd = async () => {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    try {
      await onAdd(text)
      setDraft('')
    } finally {
      setAdding(false)
    }
  }

  const handleClose = () => {
    setEditingId(null)
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={handleClose}
          />

          <motion.div
            key="drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-2xl border-t border-border shadow-2xl max-h-[85vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-serif font-semibold text-foreground">To-dos</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {openTodos.length === 0
                    ? doneTodos.length > 0
                      ? 'All done'
                      : 'Nothing to do yet'
                    : `${openTodos.length} to do`}
                </p>
              </div>
              <button
                onClick={handleClose}
                aria-label="Close to-dos"
                className="rounded-full w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick add — one field, Enter to file it */}
            {canEdit && currentName && (
              <div className="px-5 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void handleAdd()
                      }
                    }}
                    placeholder="Add a to-do…"
                    className="text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleAdd()}
                    disabled={adding || !draft.trim()}
                    className="shrink-0"
                  >
                    {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </div>
            )}

            {/* Content */}
            <div
              ref={(node) => {
                scrollRef.current = node
              }}
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              {!canEdit && (
                <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
                  <p className="text-sm text-warning-foreground">
                    Join this trip to add or check off to-dos.
                  </p>
                </div>
              )}

              {openTodos.length === 0 && doneTodos.length === 0 && (
                <div className="text-center py-10">
                  <ListChecks className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Nothing to do yet.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Book the train, renew a passport, split the deposit…
                  </p>
                </div>
              )}

              {/* Open list — drag to reorder; the order is the priority */}
              <div className="relative flex flex-col gap-2">
                {openTodos.map((todo, index) => {
                  const offset = getRowOffset(index)
                  const isActive = activeIndex === index
                  return (
                    <div
                      key={todo.id}
                      ref={(node) => {
                        registerRow(todo.id, node)
                      }}
                      style={{
                        transform: offset ? `translateY(${offset}px)` : undefined,
                        transition: isActive ? 'none' : 'transform 160ms ease',
                        zIndex: isActive ? 10 : undefined,
                        position: 'relative',
                      }}
                    >
                      {editingId === todo.id ? (
                        <TodoEditor
                          todo={todo}
                          people={people}
                          onSave={async (data) => {
                            await onUpdate(todo.id, data)
                            setEditingId(null)
                          }}
                          onDelete={() => {
                            setEditingId(null)
                            void onDelete(todo.id)
                          }}
                          onCancel={() => setEditingId(null)}
                        />
                      ) : (
                        <TodoRow
                          todo={todo}
                          today={today}
                          canEdit={canEdit}
                          dragging={isActive}
                          onToggle={() => void onToggle(todo.id, true)}
                          onOpenEditor={() => setEditingId(todo.id)}
                          handleProps={handleProps(index)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Done */}
              {doneTodos.length > 0 && (
                <div className={cn(openTodos.length > 0 && 'mt-5 pt-4 border-t border-border')}>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowDone((s) => !s)}
                      aria-expanded={showDone}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown
                        className={cn(
                          'w-3.5 h-3.5 transition-transform',
                          !showDone && '-rotate-90'
                        )}
                      />
                      Done ({doneTodos.length})
                    </button>
                    {canEdit && showDone && (
                      <button
                        type="button"
                        onClick={() => void onClearDone()}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Clear done
                      </button>
                    )}
                  </div>

                  {showDone && (
                    <div className="flex flex-col gap-2 mt-3">
                      {doneTodos.map((todo) =>
                        editingId === todo.id ? (
                          <TodoEditor
                            key={todo.id}
                            todo={todo}
                            people={people}
                            onSave={async (data) => {
                              await onUpdate(todo.id, data)
                              setEditingId(null)
                            }}
                            onDelete={() => {
                              setEditingId(null)
                              void onDelete(todo.id)
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <div key={todo.id} className="opacity-70">
                            <TodoRow
                              todo={todo}
                              today={today}
                              canEdit={canEdit}
                              dragging={false}
                              onToggle={() => void onToggle(todo.id, false)}
                              onOpenEditor={() => setEditingId(todo.id)}
                            />
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
