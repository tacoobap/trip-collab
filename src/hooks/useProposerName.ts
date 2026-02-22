import { useState, useEffect } from 'react'

const STORAGE_KEY = 'tripboard_name'
const NAMES_USED_KEY = 'tripboard_names_used'
const MAX_NAMES_USED = 10

function loadNamesUsed(): string[] {
  try {
    const raw = localStorage.getItem(NAMES_USED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

export function useProposerName() {
  const [name, setNameState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })
  const [namesUsed, setNamesUsedState] = useState<string[]>(loadNamesUsed)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nameFromUrl = params.get('name')
    if (nameFromUrl && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, nameFromUrl)
      setNameState(nameFromUrl)
      addToNamesUsed(nameFromUrl)
    }
  }, [])

  function addToNamesUsed(newName: string) {
    const trimmed = newName.trim()
    if (!trimmed) return
    setNamesUsedState((prev) => {
      const next = [trimmed, ...prev.filter((n) => n !== trimmed)].slice(0, MAX_NAMES_USED)
      localStorage.setItem(NAMES_USED_KEY, JSON.stringify(next))
      return next
    })
  }

  const setName = (newName: string) => {
    const trimmed = newName.trim()
    if (!trimmed) return
    localStorage.setItem(STORAGE_KEY, trimmed)
    setNameState(trimmed)
    addToNamesUsed(trimmed)
  }

  const clearName = () => {
    localStorage.removeItem(STORAGE_KEY)
    setNameState(null)
  }

  return { name, setName, clearName, namesUsed }
}
