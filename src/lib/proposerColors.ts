const PALETTE = [
  { bg: 'hsl(172, 35%, 45%)', text: '#fff', label: 'teal' },
  { bg: 'hsl(38, 70%, 55%)', text: '#fff', label: 'golden' },
  { bg: 'hsl(15, 60%, 60%)', text: '#fff', label: 'coral' },
  { bg: 'hsl(145, 15%, 55%)', text: '#fff', label: 'sage' },
  { bg: 'hsl(215, 35%, 25%)', text: '#fff', label: 'navy' },
  { bg: 'hsl(265, 30%, 60%)', text: '#fff', label: 'lavender' },
  { bg: 'hsl(330, 40%, 60%)', text: '#fff', label: 'rose' },
  { bg: 'hsl(195, 50%, 45%)', text: '#fff', label: 'sky' },
]

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export function getProposerColor(name: string) {
  return PALETTE[hashName(name) % PALETTE.length]
}

export function getProposerInitial(name: string) {
  return name.trim().charAt(0).toUpperCase()
}
