import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useMpaBle } from '@/hooks/useMpaBle'
import { MpaContext, type MpaContextValue } from './mpaContext'

type DataListener = (data: DataView) => void

export function MpaProvider({ children }: { children: ReactNode }) {
  const listenersRef = useRef(new Set<DataListener>())
  const [sessionInterrupted, setSessionInterrupted] = useState(false)

  const handleData = useCallback((data: DataView) => {
    listenersRef.current.forEach((listener) => listener(data))
  }, [])

  const handleInterrupted = useCallback(() => setSessionInterrupted(true), [])

  const mpa = useMpaBle(handleData, handleInterrupted)

  const subscribeData = useCallback((listener: DataListener) => {
    listenersRef.current.add(listener)
    return () => {
      listenersRef.current.delete(listener)
    }
  }, [])

  const clearSessionInterrupted = useCallback(() => setSessionInterrupted(false), [])

  const value: MpaContextValue = {
    ...mpa,
    subscribeData,
    sessionInterrupted,
    clearSessionInterrupted,
  }

  return <MpaContext.Provider value={value}>{children}</MpaContext.Provider>
}