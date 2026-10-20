import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useMpa } from '@/context/mpaContext'
import { isRecordingActive, type MpaStatus } from '@/ble/mpaStatus'
import { formatDuration } from '@/lib/format'

// Os nomes (value) vão pro arquivo da sessão; o firmware limita a ~11 caracteres.
const EXERCISES = [
  { value: 'agachamento', label: 'Agachamento' },
  { value: 'supino', label: 'Supino' },
  { value: 'terra', label: 'Levantamento terra' },
]

const PROBLEM_MESSAGES: Partial<Record<MpaStatus['type'], string>> = {
  calib_moving: 'O dispositivo se mexeu durante a calibração. Deixe-o parado e tente de novo.',
  rec_calib_moving: 'O dispositivo se mexeu durante a calibração. Deixe-o parado e tente de novo.',
  rec_busy: 'O aparelho está ocupado (modo ao vivo ou outra gravação).',
  rec_nomem: 'Sem memória disponível no aparelho. Apague sessões antigas e tente de novo.',
  rec_empty: 'Nenhuma amostra foi gravada.',
  rec_cancelled: 'Gravação cancelada.',
  fs_error: 'Erro no armazenamento do aparelho.',
  rec_error: 'Erro durante a gravação no aparelho.',
  imu_error: 'Falha ao ler o sensor (IMU).',
}

const inputClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50'

function Card({ children }: { children: ReactNode }) {
  return <div className='rounded-lg border bg-card p-6 text-card-foreground'>{children}</div>
}

function Banner({
  tone,
  children,
}: {
  tone: 'warning' | 'info'
  children: ReactNode
}) {
  const color =
    tone === 'warning'
      ? 'border-amber-500/50 bg-amber-500/10'
      : 'border-sky-500/50 bg-sky-500/10'
  return <div className={`rounded-md border px-4 py-3 text-sm ${color}`}>{children}</div>
}

export default function MonitoringPage() {
  const navigate = useNavigate()
  const {
    status,
    deviceName,
    deviceStatus,
    startRecording,
    stopRecording,
    stopLive,
    sessionInterrupted,
    clearSessionInterrupted,
  } = useMpa()

  const [athlete, setAthlete] = useState('')
  const [exercise, setExercise] = useState(EXERCISES[0].value)
  const [loadKg, setLoadKg] = useState('')
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const type = deviceStatus?.type
  const connected = status === 'connected'
  const reconnecting = status === 'reconnecting'
  const recActive = deviceStatus !== null && isRecordingActive(deviceStatus)
  const liveActive = type === 'streaming' || type === 'calibrating'
  const isRecording = type === 'rec_recording'

  // Cronômetro da gravação (conta a partir de quando esta tela viu "gravando")
  useEffect(() => {
    if (!isRecording) return
    const t0 = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 250)
    return () => {
      clearInterval(id)
      setElapsed(0)
    }
  }, [isRecording])

  async function handleStart() {
    setActionError(null)
    clearSessionInterrupted()
    setSending(true)
    try {
      await startRecording({ athlete, exercise, loadKg: Number(loadKg) || 0 })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha ao iniciar a gravação.')
    } finally {
      setSending(false)
    }
  }

  async function handleStop() {
    setActionError(null)
    try {
      await stopRecording()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha ao parar a gravação.')
    }
  }

  async function handleStopLive() {
    setActionError(null)
    try {
      await stopLive()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha ao parar o modo ao vivo.')
    }
  }

  const problem = type ? PROBLEM_MESSAGES[type] : undefined

  return (
    <div className='mx-auto flex w-full max-w-2xl flex-col gap-4 p-6'>
      <div>
        <h1 className='text-xl font-semibold'>Monitoramento</h1>
        <p className='text-sm text-muted-foreground'>
          {connected || reconnecting
            ? `Dispositivo: ${deviceName ?? 'MPA'}`
            : 'Nenhum dispositivo conectado'}
        </p>
      </div>

      {reconnecting && (
        <Banner tone='info'>
          Reconectando ao MPA…{' '}
          {isRecording && 'A gravação continua no aparelho enquanto isso.'}
        </Banner>
      )}

      {sessionInterrupted && (
        <Banner tone='warning'>
          <div className='flex items-start justify-between gap-4'>
            <span>
              A conexão caiu e o aparelho não estava mais gravando quando voltou. Os dados dessa
              tentativa podem estar incompletos; confira em Sessões.
            </span>
            <button
              type='button'
              onClick={clearSessionInterrupted}
              className='shrink-0 text-xs underline hover:cursor-pointer'
            >
              Dispensar
            </button>
          </div>
        </Banner>
      )}

      {actionError && <Banner tone='warning'>{actionError}</Banner>}

      {!connected && !reconnecting && (
        <Card>
          <p className='mb-4 text-sm text-muted-foreground'>
            Conecte o MPA para começar uma gravação.
          </p>
          <Button type='button' onClick={() => navigate('/devices')} className='hover:cursor-pointer'>
            Ir para Dispositivos
          </Button>
        </Card>
      )}

      {(connected || reconnecting) && recActive && (
        <Card>
          {type === 'rec_calibrating' && deviceStatus?.type === 'rec_calibrating' && (
            <div className='flex flex-col gap-2'>
              <h2 className='font-medium'>Calibrando…</h2>
              <p className='text-sm text-muted-foreground'>
                Mantenha o dispositivo totalmente parado.
                {deviceStatus.maxSec > 0 && ` A gravação terá no máximo ${deviceStatus.maxSec} s.`}
              </p>
            </div>
          )}

          {type === 'rec_countdown' && deviceStatus?.type === 'rec_countdown' && (
            <div className='flex flex-col items-center gap-2 py-4'>
              <span className='text-sm text-muted-foreground'>Prepare-se</span>
              <span className='text-6xl font-semibold tabular-nums'>{deviceStatus.remaining}</span>
            </div>
          )}

          {type === 'rec_recording' && (
            <div className='flex flex-col items-center gap-4 py-2'>
              <div className='flex items-center gap-2 text-sm'>
                <span className='inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500' />
                Gravando
              </div>
              <span className='text-5xl font-semibold tabular-nums'>{formatDuration(elapsed)}</span>
              <Button
                type='button'
                variant='destructive'
                onClick={handleStop}
                disabled={!connected}
                className='hover:cursor-pointer'
              >
                Parar gravação
              </Button>
              <p className='text-xs text-muted-foreground'>
                A gravação também para sozinha quando a memória do aparelho enche.
              </p>
            </div>
          )}

          {type === 'rec_saving' && (
            <div className='flex flex-col gap-2'>
              <h2 className='font-medium'>Salvando…</h2>
              <p className='text-sm text-muted-foreground'>Gravando o arquivo na memória do aparelho.</p>
            </div>
          )}
        </Card>
      )}

      {(connected || reconnecting) && liveActive && (
        <Card>
          <h2 className='mb-1 font-medium'>Aparelho em modo ao vivo</h2>
          <p className='mb-4 text-sm text-muted-foreground'>
            Pare o modo ao vivo para poder gravar.
          </p>
          <Button type='button' variant='outline' onClick={handleStopLive} className='hover:cursor-pointer'>
            Parar modo ao vivo
          </Button>
        </Card>
      )}

      {connected && !recActive && !liveActive && (
        <>
          {deviceStatus?.type === 'rec_saved' && (
            <Banner tone='info'>
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <span>
                  Gravação salva: <strong>{deviceStatus.name}</strong> ({deviceStatus.count} amostras
                  {deviceStatus.missed > 0 && `, ${deviceStatus.missed} perdidas`}).
                </span>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => navigate('/sessions')}
                  className='hover:cursor-pointer'
                >
                  Ver sessões
                </Button>
              </div>
            </Banner>
          )}

          {problem && <Banner tone='warning'>{problem}</Banner>}

          <Card>
            <h2 className='mb-4 font-medium'>Nova gravação</h2>
            <div className='flex flex-col gap-4'>
              <label className='flex flex-col gap-1 text-sm'>
                Atleta
                <input
                  className={inputClass}
                  value={athlete}
                  onChange={(e) => setAthlete(e.target.value)}
                  placeholder='Nome do atleta'
                />
              </label>

              <div className='grid grid-cols-2 gap-4'>
                <label className='flex flex-col gap-1 text-sm'>
                  Exercício
                  <select
                    className={inputClass}
                    value={exercise}
                    onChange={(e) => setExercise(e.target.value)}
                  >
                    {EXERCISES.map((ex) => (
                      <option key={ex.value} value={ex.value}>
                        {ex.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className='flex flex-col gap-1 text-sm'>
                  Carga (kg)
                  <input
                    className={inputClass}
                    type='number'
                    min={0}
                    max={999}
                    inputMode='numeric'
                    value={loadKg}
                    onChange={(e) => setLoadKg(e.target.value)}
                    placeholder='0'
                  />
                </label>
              </div>

              <Button
                type='button'
                onClick={handleStart}
                disabled={!athlete.trim() || sending}
                className='hover:cursor-pointer'
              >
                {sending ? 'Enviando…' : 'Iniciar gravação'}
              </Button>
              <p className='text-xs text-muted-foreground'>
                O aparelho calibra o giroscópio (deixe-o parado), faz uma contagem regressiva e
                começa a gravar.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}