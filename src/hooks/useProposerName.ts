import { useState, useEffect } from 'react'

const STORAGE_KEY = 'tripboard_name'

export function useProposerName() {
  const [name, setNameState] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY)
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const nameFromUrl = params.get('name')
    if (nameFromUrl && !localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, nameFromUrl)
      setNameState(nameFromUrl)
    }
  }, [])

  const setName = (newName: string) => {
    localStorage.setItem(STORAGE_KEY, newName)
    setNameState(newName)
  }

  const clearName = () => {
    localStorage.removeItem(STORAGE_KEY)
    setNameState(null)
  }

  return { name, setName, clearName }
}
