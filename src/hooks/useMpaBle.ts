import { useCallback, useEffect, useRef, useState } from 'react'
import { MpaBle } from '@/ble/mpaBle'
import { MpaControl, type RecParams } from '@/ble/mpaControl'
import { MpaSessions, type DeviceFile, type DeviceFileList } from '@/ble/mpaSessions'
import {
  isDeviceState,
  isRecordingActive,
  isTerminalStatus,
  type MpaStatus,
} from '@/ble/mpaStatus'
import { MpaStream } from '@/ble/mpaStream'
import { MpaTransfer } from '@/ble/mpaTransfer'
import { loadSession } from '@/sessions/loadSession'
import type { Session } from '@/sessions/parseSession'

export type BleStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/** O que o dispositivo está fazendo: modo ao vivo ou mapeamento (gravação). */
export type RunKind = 'live' | 'recording'

const MAX_RECONNECT_ATTEMPTS = 10
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const NOT_CONNECTED = 'Dispositivo não conectado'

/**
 * Fluxo:
 * - connect(): abre o seletor do navegador (chamar direto no clique do botão).
 * - Se o link cair, reconecta sozinho (sem seletor), reassina os notifies e
 *   confere o status do dispositivo:
 *     · gravação (mapeamento): o aparelho continua gravando durante a queda;
 *       só é "interrompida" se ele não estiver mais gravando nem tiver salvo.
 *     · modo ao vivo: o firmware PARA o stream ao desconectar, então a
 *       reconexão sempre avisa que foi interrompido (um novo "start" exige
 *       calibrar com a barra parada).
 *   O aviso sai por onSessionInterrupted(kind).
 */
export function useMpaBle(
  onData: (data: DataView) => void,
  onSessionInterrupted?: (kind: RunKind) => void,
) {
  const [status, setStatus] = useState<BleStatus>('idle')
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [deviceStatus, setDeviceStatus] = useState<MpaStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const bleRef = useRef<MpaBle | null>(null)
  const controlRef = useRef<MpaControl | null>(null)
  const streamRef = useRef<MpaStream | null>(null)
  const transferRef = useRef<MpaTransfer | null>(null)
  const sessionsRef = useRef<MpaSessions | null>(null)

  const activeKindRef = useRef<RunKind | null>(null)
  const userDisconnectRef = useRef(false)
  const reconnectingRef = useRef(false)

  const onDataRef = useRef(onData)
  const onInterruptedRef = useRef(onSessionInterrupted)
  useEffect(() => {
    onDataRef.current = onData
    onInterruptedRef.current = onSessionInterrupted
  }, [onData, onSessionInterrupted])

  const disposeServices = useCallback(() => {
    controlRef.current?.dispose()
    streamRef.current?.dispose()
    transferRef.current?.dispose()
    controlRef.current = null
    streamRef.current = null
    transferRef.current = null
    sessionsRef.current = null
  }, [])

  // Cria instâncias novas dos serviços (as antigas ficam inválidas após uma
  // queda), assina os notifies e devolve o status atual do dispositivo.
  // Operações GATT precisam ser sequenciais.
  const setupServices = useCallback(
    async (server: BluetoothRemoteGATTServer): Promise<MpaStatus> => {
      disposeServices()

      const control = new MpaControl(server)
      const stream = new MpaStream(server, (d) => onDataRef.current(d))
      const transfer = new MpaTransfer(server)
      controlRef.current = control
      streamRef.current = stream
      transferRef.current = transfer
      sessionsRef.current = new MpaSessions(control, transfer)

      control.onStatus((s) => {
        if (isTerminalStatus(s)) activeKindRef.current = null
        if (isDeviceState(s)) setDeviceStatus(s)
      })

      const current = await control.init()
      await stream.subscribe()
      await transfer.subscribe()

      if (isDeviceState(current)) setDeviceStatus(current)
      return current
    },
    [disposeServices],
  )

  // Chamado quando o link cai sem o usuário ter pedido.
  const onLinkLost = useCallback(async () => {
    if (userDisconnectRef.current) return
    if (reconnectingRef.current) return

    reconnectingRef.current = true
    setStatus('reconnecting')

    // O que estava rodando ANTES da queda (os status lidos na reconexão
    // podem limpar activeKindRef antes de a gente comparar).
    const kindBefore = activeKindRef.current

    try {
      for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS; attempt++) {
        if (userDisconnectRef.current) return
        try {
          const server = await bleRef.current!.reconnect()
          const current = await setupServices(server)

          if (kindBefore !== null) {
            const finished = kindBefore === 'recording' && current.type === 'rec_saved'
            const stillRunning = kindBefore === 'recording' && isRecordingActive(current)
            if (finished) {
              activeKindRef.current = null
            } else if (!stillRunning) {
              activeKindRef.current = null
              onInterruptedRef.current?.(kindBefore)
            }
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

  // Devolve true se conectou. Chamar direto no clique do usuário.
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
      // requestDevice() é chamado aqui, sem nenhum await antes (precisa do clique)
      const { server, name } = await bleRef.current.connect()
      await setupServices(server)
      setDeviceName(name)
      setStatus('connected')
      return true
    } catch (e) {
      // Usuário fechou o seletor: não é erro
      if (e instanceof DOMException && e.name === 'NotFoundError') {
        setStatus('idle')
        return false
      }
      // Falhou depois de conectar (ex.: serviço não encontrado): fecha o link
      userDisconnectRef.current = true
      disposeServices()
      bleRef.current?.disconnect()
      setError(e instanceof Error ? e.message : 'Falha ao conectar')
      setStatus('error')
      return false
    }
  }, [onLinkLost, setupServices, disposeServices])

  /** Tenta reconectar ao mesmo dispositivo (sem seletor), ex.: após status "error". */
  const reconnect = useCallback(() => {
    if (!bleRef.current?.hasDevice) return // página recarregada: use connect()
    userDisconnectRef.current = false
    setError(null)
    void onLinkLost()
  }, [onLinkLost])

  const disconnect = useCallback(async () => {
    userDisconnectRef.current = true
    activeKindRef.current = null
    try {
      await streamRef.current?.unsubscribe()
    } catch {
      // link já caiu: nada a fazer
    }
    disposeServices()
    bleRef.current?.disconnect()

    setDeviceName(null)
    setDeviceStatus(null)
    setStatus('idle')
  }, [disposeServices])

  // ---------------------------------------------------------------- modo ao vivo
  const startLive = useCallback(async () => {
    const control = controlRef.current
    if (!control) throw new Error(NOT_CONNECTED)
    activeKindRef.current = 'live'
    try {
      await control.startLive()
    } catch (e) {
      activeKindRef.current = null
      throw e
    }
  }, [])

  const stopLive = useCallback(async () => {
    const control = controlRef.current
    if (!control) throw new Error(NOT_CONNECTED)
    await control.stopLive()
    activeKindRef.current = null
  }, [])

  // ---------------------------------------------------------------- mapeamento
  // O andamento (calibrando, contagem, gravando, salvando, salvo) chega em
  // `deviceStatus`.
  const startRecording = useCallback(async (params: RecParams) => {
    const control = controlRef.current
    if (!control) throw new Error(NOT_CONNECTED)
    activeKindRef.current = 'recording'
    try {
      await control.startRecording(params)
    } catch (e) {
      activeKindRef.current = null
      throw e
    }
  }, [])

  const stopRecording = useCallback(async () => {
    const control = controlRef.current
    if (!control) throw new Error(NOT_CONNECTED)
    await control.stopRecording() // activeKindRef é limpo quando o aparelho avisar
  }, [])

  // ---------------------------------------------------------------- arquivos
  // Só funcionam com o aparelho parado (sem gravar e sem modo ao vivo).
  const listFiles = useCallback((): Promise<DeviceFileList> => {
    const sessions = sessionsRef.current
    if (!sessions) return Promise.reject(new Error(NOT_CONNECTED))
    return sessions.list()
  }, [])

  /** Usa o cache local quando já baixou; senão baixa, valida o CRC e guarda. */
  const downloadSession = useCallback(
    (file: DeviceFile, onProgress?: (fraction: number) => void): Promise<Session> => {
      const sessions = sessionsRef.current
      if (!sessions) return Promise.reject(new Error(NOT_CONNECTED))
      return loadSession(file, sessions, onProgress)
    },
    [],
  )

  const deleteFile = useCallback((name: string): Promise<void> => {
    const sessions = sessionsRef.current
    if (!sessions) return Promise.reject(new Error(NOT_CONNECTED))
    return sessions.remove(name)
  }, [])

  // Limpeza ao desmontar
  useEffect(() => {
    userDisconnectRef.current = false
    return () => {
      userDisconnectRef.current = true
      disposeServices()
      bleRef.current?.disconnect()
    }
  }, [disposeServices])

  return {
    isSupported: MpaBle.isSupported(),
    status,
    deviceName,
    deviceStatus,
    error,
    connect,
    reconnect,
    disconnect,
    startLive,
    stopLive,
    startRecording,
    stopRecording,
    listFiles,
    downloadSession,
    deleteFile,
  }
}