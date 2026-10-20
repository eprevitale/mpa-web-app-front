import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignalChart, type ChartSeries } from '@/components/sessions/SignalChart'
import { loadStoredSession } from '@/sessions/sessionStore'
import {
  ACC_LSB_PER_G,
  CHANNEL,
  GYR_LSB_PER_DPS,
  type Session,
} from '@/sessions/parseSession'
import { formatDuration } from '@/lib/format'

const COLORS = ['#ef4444', '#22c55e', '#3b82f6']

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex flex-col'>
      <dt className='text-xs text-muted-foreground'>{label}</dt>
      <dd className='text-sm font-medium tabular-nums'>{children}</dd>
    </div>
  )
}

export default function SessionDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    loadStoredSession(id)
      .then((s) => {
        if (cancelled) return
        if (s) setSession(s)
        else setError('Sessão não encontrada neste navegador.')
      })
      .catch(() => {
        if (!cancelled) setError('Falha ao abrir a sessão.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // Valores brutos -> unidades físicas. O offset do giroscópio medido na
  // calibração (guardado no cabeçalho) é subtraído aqui, só pra exibição.
  const { accSeries, gyrSeries } = useMemo<{
    accSeries: ChartSeries[]
    gyrSeries: ChartSeries[]
  }>(() => {
    if (!session) return { accSeries: [], gyrSeries: [] }
    const { ch, n, header } = session

    const acc = (c: Int16Array) => {
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) out[i] = c[i] / ACC_LSB_PER_G
      return out
    }
    const gyr = (c: Int16Array, offset: number) => {
      const out = new Float32Array(n)
      for (let i = 0; i < n; i++) out[i] = (c[i] - offset) / GYR_LSB_PER_DPS
      return out
    }

    return {
      accSeries: [
        { label: 'ax', color: COLORS[0], data: acc(ch[CHANNEL.ax]) },
        { label: 'ay', color: COLORS[1], data: acc(ch[CHANNEL.ay]) },
        { label: 'az', color: COLORS[2], data: acc(ch[CHANNEL.az]) },
      ],
      gyrSeries: [
        { label: 'gx', color: COLORS[0], data: gyr(ch[CHANNEL.gx], header.gyroOff[0]) },
        { label: 'gy', color: COLORS[1], data: gyr(ch[CHANNEL.gy], header.gyroOff[1]) },
        { label: 'gz', color: COLORS[2], data: gyr(ch[CHANNEL.gz], header.gyroOff[2]) },
      ],
    }
  }, [session])

  const message = !id ? 'Sessão inválida.' : error
  const h = session?.header

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-6 p-6'>
      <div>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onClick={() => navigate('/sessions')}
          className='-ml-2 hover:cursor-pointer'
        >
          <ArrowLeft />
          Sessões
        </Button>
      </div>

      {loading && id && !message && <p className='text-sm text-muted-foreground'>Carregando…</p>}
      {message && (
        <div className='rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm'>
          {message}
        </div>
      )}

      {session && h && (
        <>
          <div>
            <h1 className='text-xl font-semibold'>
              {h.athlete} · {h.exercise}
            </h1>
            <p className='text-sm text-muted-foreground'>{session.name}</p>
          </div>

          <dl className='grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4'>
            <Info label='Carga'>{h.loadKg > 0 ? `${h.loadKg} kg` : '—'}</Info>
            <Info label='Duração'>{formatDuration(session.n / h.rateHz)}</Info>
            <Info label='Amostras'>{session.n}</Info>
            <Info label='Taxa'>{h.rateHz} Hz</Info>
            <Info label='Amostras perdidas'>{h.missed}</Info>
            <Info label='Integridade (CRC)'>{session.crcOk ? 'OK' : 'Falhou'}</Info>
            <Info label='Offset do giroscópio'>{h.gyroOff.join(' / ')}</Info>
            <Info label='Escalas'>
              ±{h.accRange} g · ±{h.gyrRange} °/s
            </Info>
          </dl>

          <SignalChart title='Acelerômetro (g)' series={accSeries} rateHz={h.rateHz} />
          <SignalChart title='Giroscópio (°/s)' series={gyrSeries} rateHz={h.rateHz} />

          <div className='rounded-lg border border-dashed p-4 text-sm text-muted-foreground'>
            Análise (repetições, MCV, PV, MVT e VL%): próximo passo. Os gráficos acima mostram o
            sinal bruto, para conferir se a gravação chegou certa.
          </div>
        </>
      )}
    </div>
  )
}