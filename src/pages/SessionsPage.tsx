import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Eye, RefreshCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMpa } from '@/context/mpaContext'
import type { DeviceFile, DeviceFileList } from '@/ble/mpaSessions'
import { isRecordingActive } from '@/ble/mpaStatus'
import {
  listStored,
  removeStored,
  sessionId,
  type StoredSessionMeta,
} from '@/sessions/sessionStore'
import { formatBytes, formatDateTime, formatDuration } from '@/lib/format'

// Taxa de amostragem do firmware (também vem no cabeçalho de cada arquivo)
const SAMPLE_RATE_HZ = 400

const openSessionUrl = (id: string) => `/sessions/${encodeURIComponent(id)}`

export default function SessionsPage() {
  const navigate = useNavigate()
  const { status, deviceStatus, listFiles, downloadSession, deleteFile } = useMpa()

  const [device, setDevice] = useState<DeviceFileList | null>(null)
  const [deviceError, setDeviceError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [loadedTick, setLoadedTick] = useState(-1)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ name: string; percent: number } | null>(null)
  const [local, setLocal] = useState<StoredSessionMeta[]>([])

  const connected = status === 'connected'
  const deviceBusy =
    deviceStatus !== null &&
    (isRecordingActive(deviceStatus) ||
      deviceStatus.type === 'streaming' ||
      deviceStatus.type === 'calibrating')

  const canQuery = connected && !deviceBusy
  const loadingList = canQuery && loadedTick !== reloadTick
  const reloadDevice = () => setReloadTick((t) => t + 1)

  // Usado depois de baixar/remover (em handlers de evento)
  const refreshLocal = useCallback(async () => {
    setLocal(await listStored())
  }, [])

  // Carga inicial das sessões guardadas no navegador
  useEffect(() => {
    let cancelled = false
    listStored().then((rows) => {
      if (!cancelled) setLocal(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Lista o aparelho ao conectar, quando ele termina de gravar e a cada "Atualizar"
  useEffect(() => {
    if (!canQuery) return
    let cancelled = false
    listFiles()
      .then((list) => {
        if (cancelled) return
        setDevice(list)
        setDeviceError(null)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setDeviceError(e instanceof Error ? e.message : 'Falha ao listar as sessões do aparelho.')
      })
      .finally(() => {
        if (!cancelled) setLoadedTick(reloadTick)
      })
    return () => {
      cancelled = true
    }
  }, [canQuery, reloadTick, listFiles])

  const isCached = (f: DeviceFile) =>
    local.some((l) => l.name === f.name && l.size === f.size && l.count === f.count)

  async function handleOpenOrDownload(file: DeviceFile) {
    setBusyName(file.name)
    setProgress({ name: file.name, percent: 0 })
    setDeviceError(null)
    let last = -1
    try {
      const session = await downloadSession(file, (fraction) => {
        const percent = Math.floor(fraction * 100)
        if (percent === last) return
        last = percent
        setProgress({ name: file.name, percent })
      })
      await refreshLocal()
      navigate(openSessionUrl(sessionId(session.name, session.header.crc)))
    } catch (e) {
      setDeviceError(
        `Falha ao baixar ${file.name}: ${e instanceof Error ? e.message : 'erro desconhecido'}. Tente de novo.`,
      )
    } finally {
      setBusyName(null)
      setProgress(null)
    }
  }

  async function handleDeleteFromDevice(file: DeviceFile) {
    if (!window.confirm(`Apagar ${file.name} da memória do aparelho? Não dá para desfazer.`)) return
    setBusyName(file.name)
    setDeviceError(null)
    try {
      await deleteFile(file.name)
      reloadDevice()
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : 'Falha ao apagar.')
    } finally {
      setBusyName(null)
    }
  }

  async function handleRemoveLocal(meta: StoredSessionMeta) {
    if (!window.confirm(`Remover ${meta.name} deste navegador? A cópia no aparelho não é afetada.`)) {
      return
    }
    await removeStored(meta.id)
    await refreshLocal()
  }

  const downloading = busyName !== null

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-8 p-6'>
      <div>
        <h1 className='text-xl font-semibold'>Sessões</h1>
        <p className='text-sm text-muted-foreground'>
          Gravações salvas no aparelho e cópias já baixadas neste navegador.
        </p>
      </div>

      {/* ---------------------------------------------------------- no aparelho */}
      <section className='flex flex-col gap-3'>
        <div className='flex items-center justify-between gap-3'>
          <div>
            <h2 className='font-medium'>No aparelho</h2>
            {device && (
              <p className='text-xs text-muted-foreground'>
                Memória usada: {formatBytes(device.used)} de {formatBytes(device.total)}
              </p>
            )}
          </div>
          {connected && (
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={reloadDevice}
              disabled={loadingList || deviceBusy || downloading}
              className='hover:cursor-pointer'
            >
              <RefreshCw className={loadingList ? 'animate-spin' : ''} />
              Atualizar
            </Button>
          )}
        </div>

        {!connected && (
          <div className='rounded-lg border bg-card p-6 text-sm'>
            <p className='mb-4 text-muted-foreground'>
              Conecte o MPA para ver e baixar as sessões salvas nele.
            </p>
            <Button type='button' onClick={() => navigate('/devices')} className='hover:cursor-pointer'>
              Ir para Dispositivos
            </Button>
          </div>
        )}

        {connected && deviceBusy && (
          <div className='rounded-md border border-sky-500/50 bg-sky-500/10 px-4 py-3 text-sm'>
            O aparelho está gravando ou em modo ao vivo. A lista fica disponível quando ele parar.
          </div>
        )}

        {deviceError && (
          <div className='rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm'>
            {deviceError}
          </div>
        )}

        {connected && !deviceBusy && device && device.files.length === 0 && !loadingList && (
          <p className='text-sm text-muted-foreground'>Nenhuma sessão salva no aparelho.</p>
        )}

        {connected && device && device.files.length > 0 && (
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 font-medium'>Sessão</th>
                  <th className='px-4 py-2 font-medium'>Duração</th>
                  <th className='px-4 py-2 font-medium'>Perdidas</th>
                  <th className='px-4 py-2 font-medium'>Tamanho</th>
                  <th className='px-4 py-2 text-right font-medium'>Ações</th>
                </tr>
              </thead>
              <tbody>
                {device.files.map((f) => {
                  const active = busyName === f.name
                  const cached = isCached(f)
                  return (
                    <tr key={f.name} className='border-t'>
                      <td className='px-4 py-3'>
                        <div className='font-medium'>
                          {f.athlete} · {f.exercise}
                        </div>
                        <div className='text-xs text-muted-foreground'>{f.name}</div>
                      </td>
                      <td className='px-4 py-3 tabular-nums'>
                        {formatDuration(f.count / SAMPLE_RATE_HZ)}
                      </td>
                      <td className='px-4 py-3 tabular-nums'>{f.missed}</td>
                      <td className='px-4 py-3 tabular-nums'>{formatBytes(f.size)}</td>
                      <td className='px-4 py-3'>
                        <div className='flex items-center justify-end gap-2'>
                          {active && progress?.name === f.name && (
                            <span className='text-xs tabular-nums text-muted-foreground'>
                              {progress.percent}%
                            </span>
                          )}
                          <Button
                            type='button'
                            size='sm'
                            onClick={() => void handleOpenOrDownload(f)}
                            disabled={downloading || deviceBusy}
                            className='hover:cursor-pointer'
                          >
                            {cached ? <Eye /> : <Download />}
                            {cached ? 'Abrir' : 'Baixar'}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => void handleDeleteFromDevice(f)}
                            disabled={downloading || deviceBusy}
                            aria-label={`Apagar ${f.name} do aparelho`}
                            className='hover:cursor-pointer'
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {progress && (
          <div className='h-1.5 w-full overflow-hidden rounded-full bg-muted'>
            <div
              className='h-full bg-primary transition-[width]'
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        )}
      </section>

      {/* --------------------------------------------------- neste navegador */}
      <section className='flex flex-col gap-3'>
        <h2 className='font-medium'>Neste navegador</h2>

        {local.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            Nenhuma sessão baixada ainda. As que você baixar do aparelho ficam aqui e abrem sem
            precisar do MPA conectado.
          </p>
        ) : (
          <div className='overflow-x-auto rounded-lg border'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
                <tr>
                  <th className='px-4 py-2 font-medium'>Sessão</th>
                  <th className='px-4 py-2 font-medium'>Carga</th>
                  <th className='px-4 py-2 font-medium'>Duração</th>
                  <th className='px-4 py-2 font-medium'>Baixada em</th>
                  <th className='px-4 py-2 text-right font-medium'>Ações</th>
                </tr>
              </thead>
              <tbody>
                {local.map((m) => (
                  <tr key={m.id} className='border-t'>
                    <td className='px-4 py-3'>
                      <div className='font-medium'>
                        {m.athlete} · {m.exercise}
                      </div>
                      <div className='text-xs text-muted-foreground'>{m.name}</div>
                    </td>
                    <td className='px-4 py-3 tabular-nums'>{m.loadKg > 0 ? `${m.loadKg} kg` : '—'}</td>
                    <td className='px-4 py-3 tabular-nums'>
                      {formatDuration(m.count / (m.rateHz || SAMPLE_RATE_HZ))}
                    </td>
                    <td className='px-4 py-3 tabular-nums'>{formatDateTime(m.downloadedAt)}</td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center justify-end gap-2'>
                        <Button
                          type='button'
                          size='sm'
                          onClick={() => navigate(openSessionUrl(m.id))}
                          className='hover:cursor-pointer'
                        >
                          <Eye />
                          Abrir
                        </Button>
                        <Button
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => void handleRemoveLocal(m)}
                          aria-label={`Remover ${m.name} deste navegador`}
                          className='hover:cursor-pointer'
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}