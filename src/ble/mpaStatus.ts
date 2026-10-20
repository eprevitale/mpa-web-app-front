// Status do dispositivo (characteristic "status" do serviço de controle).
// O firmware manda texto, com campos separados por "|". Aqui ele vira um
// objeto tipado (união discriminada pelo campo `type`).

export type MpaStatus =
  // --- estado do dispositivo / modo ao vivo
  | { type: 'idle' }
  | { type: 'imu_error' }
  | { type: 'calibrating' }
  | { type: 'streaming' }
  | { type: 'calib_moving' }
  // --- mapeamento (gravação no aparelho)
  | { type: 'rec_calibrating'; maxSec: number }
  | { type: 'rec_countdown'; remaining: number }
  | { type: 'rec_recording' }
  | { type: 'rec_saving' }
  | { type: 'rec_saved'; name: string; count: number; missed: number; reason: string }
  | { type: 'rec_calib_moving' }
  | { type: 'rec_cancelled' }
  | { type: 'rec_busy' }
  | { type: 'rec_nomem' }
  | { type: 'rec_empty' }
  | { type: 'fs_error' }
  | { type: 'rec_error'; reason: string }
  // --- respostas a list / get / del
  | { type: 'fs'; used: number; total: number }
  | {
      type: 'file'
      name: string
      size: number
      count: number
      missed: number
      athlete: string
      exercise: string
    }
  | { type: 'list_end' }
  | { type: 'xfer_start'; name: string; size: number }
  | { type: 'xfer_end'; name: string; received: number }
  | { type: 'get_error'; name: string }
  | { type: 'del_ok'; name: string }
  | { type: 'del_error'; name: string }
  // --- qualquer outra coisa
  | { type: 'unknown'; raw: string }

const toInt = (s: string | undefined): number => {
  const n = Number.parseInt(s ?? '', 10)
  return Number.isFinite(n) ? n : 0
}

export function parseStatus(text: string): MpaStatus {
  const raw = text.trim()
  const p = raw.split('|')

  switch (p[0]) {
    case 'idle':
      return { type: 'idle' }
    case 'imu_error':
      return { type: 'imu_error' }
    case 'calibrating':
      return { type: 'calibrating' }
    case 'streaming':
      return { type: 'streaming' }
    case 'calib_moving':
      return { type: 'calib_moving' }

    case 'rec_calibrating':
      return { type: 'rec_calibrating', maxSec: toInt(p[1]) }
    case 'rec_cd':
      return { type: 'rec_countdown', remaining: toInt(p[1]) }
    case 'rec_recording':
      return { type: 'rec_recording' }
    case 'rec_saving':
      return { type: 'rec_saving' }
    case 'rec_saved':
      return {
        type: 'rec_saved',
        name: p[1] ?? '',
        count: toInt(p[2]),
        missed: toInt(p[3]),
        reason: p[4] ?? '',
      }
    case 'rec_calib_moving':
      return { type: 'rec_calib_moving' }
    case 'rec_cancelled':
      return { type: 'rec_cancelled' }
    case 'rec_busy':
      return { type: 'rec_busy' }
    case 'rec_nomem':
      return { type: 'rec_nomem' }
    case 'rec_empty':
      return { type: 'rec_empty' }
    case 'fs_error':
      return { type: 'fs_error' }
    case 'rec_error':
      return { type: 'rec_error', reason: p[1] ?? '' }

    case 'fs':
      return { type: 'fs', used: toInt(p[1]), total: toInt(p[2]) }
    case 'file':
      return {
        type: 'file',
        name: p[1] ?? '',
        size: toInt(p[2]),
        count: toInt(p[3]),
        missed: toInt(p[4]),
        athlete: p[5] ?? '',
        exercise: p[6] ?? '',
      }
    case 'list_end':
      return { type: 'list_end' }
    case 'xfer_start':
      return { type: 'xfer_start', name: p[1] ?? '', size: toInt(p[2]) }
    case 'xfer_end':
      return { type: 'xfer_end', name: p[1] ?? '', received: toInt(p[2]) }
    case 'get_error':
      return { type: 'get_error', name: p[1] ?? '' }
    case 'del_ok':
      return { type: 'del_ok', name: p[1] ?? '' }
    case 'del_error':
      return { type: 'del_error', name: p[1] ?? '' }

    default:
      return { type: 'unknown', raw }
  }
}

type StatusType = MpaStatus['type']

// Status que descrevem "em que pé o dispositivo está" (a tela pode mostrar).
// Ficam de fora as respostas de list/get/del, que são só tráfego de comando.
const STATE_TYPES = new Set<StatusType>([
  'idle',
  'imu_error',
  'calibrating',
  'streaming',
  'calib_moving',
  'rec_calibrating',
  'rec_countdown',
  'rec_recording',
  'rec_saving',
  'rec_saved',
  'rec_calib_moving',
  'rec_cancelled',
  'rec_busy',
  'rec_nomem',
  'rec_empty',
  'fs_error',
  'rec_error',
])

// Status que encerram uma corrida (ao vivo ou gravação), com sucesso ou não.
const TERMINAL_TYPES = new Set<StatusType>([
  'rec_saved',
  'rec_empty',
  'rec_error',
  'rec_cancelled',
  'rec_calib_moving',
  'rec_busy',
  'rec_nomem',
  'fs_error',
  'imu_error',
  'calib_moving',
])

// O dispositivo está no meio de um mapeamento (calibrando, contagem, gravando ou salvando).
const RECORDING_ACTIVE_TYPES = new Set<StatusType>([
  'rec_calibrating',
  'rec_countdown',
  'rec_recording',
  'rec_saving',
])

export const isDeviceState = (s: MpaStatus): boolean => STATE_TYPES.has(s.type)
export const isTerminalStatus = (s: MpaStatus): boolean => TERMINAL_TYPES.has(s.type)
export const isRecordingActive = (s: MpaStatus): boolean => RECORDING_ACTIVE_TYPES.has(s.type)