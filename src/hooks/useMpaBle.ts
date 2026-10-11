import { useCallback, useEffect, useRef, useState } from 'react'
import { MpaBle } from '@/ble/mpaBle'
import { MpaControl } from '@/ble/mpaControl'
import { MpaStream } from '@/ble/mpaStream'

export type BleStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

const MAX_RECONNECT_ATTEMPTS = 10
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function useMpaBle(
  onData: (data: DataView) => void,
  onSessionInterrupted?: () => void,
) {
  const [status, setStatus] = useState<BleStatus>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bleRef = useRef<MpaBle | null>(null)
  const controlRef = useRef<MpaControl | null>(null)
  const streamRef = useRef<MpaStream | null>(null)

  const sessionActiveRef = useRef(false)
  const userDisconnectRef = useRef(false)
  const reconnectingRef = useRef(false)

  const onDataRef = useRef(onData)
  const onInterruptedRef = useRef(onSessionInterrupted)
  useEffect(() => {
    onDataRef.current = onData
    onInterruptedRef.current = onSessionInterrupted
  }, [onData, onSessionInterrupted])

  const setupServices = useCallback(async (server: BluetoothRemoteGATTServer) => {
    controlRef.current?.dispose()
    streamRef.current?.dispose()

    const control = new MpaControl(server, (s) => setDeviceStatus(s))
    const stream = new MpaStream(server, (d) => onDataRef.current(d))
    controlRef.current = control
    streamRef.current = stream

    const current = await control.init()
    await stream.subscribe()
    return current
  }, [])

  const onLinkLost = useCallback(async () => {
    if (userDisconnectRef.current) return
    if (reconnectingRef.current) return

    reconnectingRef.current = true
    setStatus('reconnecting')

    try {
      for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS; attempt++) {
        if (userDisconnectRef.current) return
        try {
          const server = await bleRef.current!.reconnect()
          const current = await setupServices(server)

          if (sessionActiveRef.current && current !== 'recording') {
            // O dispositivo não está gravando (reiniciou ou perdeu a sessão)
            sessionActiveRef.current = false
            onInterruptedRef.current?.()
          }
          setStatus('connected')
          return
        } catch {
          await sleep(Math.min(1000 * (attempt + 1), 5000))
        }
      }
      setError('Não foi possível reconectar ao MPA.')
      setStatus('error')
    } finally {
      reconnectingRef.current = false
    }
  }, [setupServices])

  const connect = useCallback(async (): Promise<boolean> => {
    setError(null)
    userDisconnectRef.current = false

    if (!MpaBle.isSupported()) {
      setError('Web Bluetooth não é suportado neste navegador. Use Chrome ou Edge.')
      setStatus('error')
      return false
    }

    setStatus('connecting')
    try {
      if (!bleRef.current) {
        bleRef.current = new MpaBle(() => {
          void onLinkLost()
        })
      }
      const { server, name } = await bleRef.current.connect()
      await setupServices(server)
      setDeviceName(name)
      setStatus('connected')
      return true
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        setStatus('idle')
        return false
      }
      userDisconnectRef.current = true
      bleRef.current?.disconnect()
      setError(e instanceof Error ? e.message : 'Falha ao conectar')
      setStatus('error')
      return false
    }
  }, [onLinkLost, setupServices])

  // Tenta reconectar ao mesmo dispositivo
  const reconnect = useCallback(() => {
    if (!bleRef.current?.hasDevice) return // página recarregada
    userDisconnectRef.current = false
    setError(null)
    void onLinkLost()
  }, [onLinkLost])

  const disconnect = useCallback(async () => {
    userDisconnectRef.current = true
    sessionActiveRef.current = false
    try {
      await streamRef.current?.unsubscribe()
    } catch {
      // link já caiu
    }
    streamRef.current?.dispose()
    controlRef.current?.dispose()
    streamRef.current = null
    controlRef.current = null
    bleRef.current?.disconnect()

    setDeviceName(null)
    setDeviceStatus(null)
    setStatus('idle')
  }, [])

  const startSession = useCallback(async () => {
    if (!controlRef.current) throw new Error('Dispositivo não conectado')
    sessionActiveRef.current = true
    try {
      await controlRef.current.send('start')
    } catch (e) {
      sessionActiveRef.current = false
      throw e
    }
  }, [])

  const stopSession = useCallback(async () => {
    if (!controlRef.current) throw new Error('Dispositivo não conectado')
    await controlRef.current.send('stop')
    sessionActiveRef.current = false
  }, [])

  // Limpeza ao desmontar
  useEffect(() => {
    userDisconnectRef.current = false
    return () => {
      userDisconnectRef.current = true
      streamRef.current?.dispose()
      controlRef.current?.dispose()
      bleRef.current?.disconnect()
    }
  }, [])

  return {
    isSupported: MpaBle.isSupported(),
    status,
    deviceName,
    deviceStatus,
    error,
    connect,
    reconnect,
    disconnect,
    startSession,
    stopSession,
  }
}