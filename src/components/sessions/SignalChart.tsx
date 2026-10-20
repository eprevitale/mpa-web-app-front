import { useEffect, useRef } from 'react'

export interface ChartSeries {
  label: string
  color: string
  data: ArrayLike<number>
}

interface SignalChartProps {
  title: string
  series: ChartSeries[]
  rateHz: number
  height?: number
}

const MARGIN = { left: 52, right: 8, top: 8, bottom: 22 }

function drawChart(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  series: ChartSeries[],
  rateHz: number,
  fg: string,
): void {
  const plotW = Math.max(10, width - MARGIN.left - MARGIN.right)
  const plotH = Math.max(10, height - MARGIN.top - MARGIN.bottom)
  ctx.clearRect(0, 0, width, height)

  let min = Infinity
  let max = -Infinity
  let n = 0
  for (const s of series) {
    n = Math.max(n, s.data.length)
    for (let i = 0; i < s.data.length; i++) {
      const v = s.data[i]
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  if (n === 0 || !Number.isFinite(min)) return
  if (min === max) {
    min -= 1
    max += 1
  }
  const pad = (max - min) * 0.05
  min -= pad
  max += pad

  const x = (i: number) => MARGIN.left + (i / Math.max(1, n - 1)) * plotW
  const y = (v: number) => MARGIN.top + (1 - (v - min) / (max - min)) * plotH

  ctx.font = '11px system-ui, sans-serif'
  ctx.fillStyle = fg
  ctx.strokeStyle = fg
  ctx.lineWidth = 1

  // grade horizontal e rótulos do eixo y
  const ticks = 4
  const decimals = max - min < 10 ? 2 : 0
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let k = 0; k <= ticks; k++) {
    const v = min + ((max - min) * k) / ticks
    const py = y(v)
    ctx.globalAlpha = 0.2
    ctx.beginPath()
    ctx.moveTo(MARGIN.left, py)
    ctx.lineTo(MARGIN.left + plotW, py)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillText(v.toFixed(decimals), MARGIN.left - 6, py)
  }

  // eixo x (segundos)
  const seconds = n / rateHz
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillText('0 s', MARGIN.left, height - MARGIN.bottom + 6)
  ctx.textAlign = 'center'
  ctx.fillText(`${(seconds / 2).toFixed(1)} s`, MARGIN.left + plotW / 2, height - MARGIN.bottom + 6)
  ctx.textAlign = 'right'
  ctx.fillText(`${seconds.toFixed(1)} s`, MARGIN.left + plotW, height - MARGIN.bottom + 6)

  // séries
  for (const s of series) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = 1.25
    ctx.beginPath()
    const len = s.data.length
    if (len <= plotW * 2) {
      for (let i = 0; i < len; i++) {
        if (i === 0) ctx.moveTo(x(i), y(s.data[i]))
        else ctx.lineTo(x(i), y(s.data[i]))
      }
    } else {
      // muitas amostras por pixel: desenha o mínimo e o máximo de cada coluna
      for (let px = 0; px < plotW; px++) {
        const a = Math.floor((px / plotW) * len)
        const b = Math.max(a + 1, Math.floor(((px + 1) / plotW) * len))
        let lo = Infinity
        let hi = -Infinity
        for (let i = a; i < b && i < len; i++) {
          const v = s.data[i]
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        const X = MARGIN.left + px + 0.5
        ctx.moveTo(X, y(hi))
        ctx.lineTo(X, y(lo))
      }
    }
    ctx.stroke()
  }
}

/**
 * Gráfico simples de séries temporais em canvas. Serve pra conferir os dados
 * brutos; para zoom, cursor e tempo real a gente troca por uPlot depois.
 * Passe `series` memoizado (useMemo), senão ele redesenha a cada render.
 */
export function SignalChart({ title, series, rateHz, height = 220 }: SignalChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = () => {
      const width = wrap.clientWidth
      if (width <= 0) return
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      drawChart(ctx, width, height, series, rateHz, getComputedStyle(canvas).color)
    }

    draw()
    const observer = new ResizeObserver(draw)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [series, rateHz, height])

  return (
    <div className='rounded-lg border bg-card p-4'>
      <div className='mb-2 flex flex-wrap items-center justify-between gap-2'>
        <h3 className='text-sm font-medium'>{title}</h3>
        <div className='flex gap-3 text-xs text-muted-foreground'>
          {series.map((s) => (
            <span key={s.label} className='flex items-center gap-1'>
              <span
                className='inline-block h-2 w-2 rounded-full'
                style={{ backgroundColor: s.color }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div ref={wrapRef} className='w-full'>
        <canvas ref={canvasRef} className='block text-muted-foreground' />
      </div>
    </div>
  )
}