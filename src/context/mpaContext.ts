import { createContext, useContext } from 'react'
import type { useMpaBle } from '@/hooks/useMpaBle'

export type MpaContextValue = ReturnType<typeof useMpaBle> & {
  subscribeData: (listener: (data: DataView) => void) => () => void
  // true quando a conexão voltou mas o dispositivo não estava mais gravando
  sessionInterrupted: boolean
  clearSessionInterrupted: () => void
}

export const MpaContext = createContext<MpaContextValue | null>(null)

export function useMpa(): MpaContextValue {
  const ctx = useContext(MpaContext)
  if (!ctx) throw new Error('useMpa deve ser usado dentro de <MpaProvider>')
  return ctx
}