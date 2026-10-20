import { GATT, getCharacteristic } from '@/ble/gatt'

const OFFSET_BYTES = 4 // cada pacote: [offset u32 little-endian][dados]
const END_GRACE_MS = 1000 // depois do "xfer_end", espera isso por pacotes atrasados
const IDLE_TIMEOUT_MS = 8000 // sem nenhum pacote por esse tempo = falha

/**
 * Remonta UM arquivo a partir dos pacotes recebidos.
 * Os pacotes trazem o offset, então a ordem de chegada não importa e
 * pacotes repetidos são ignorados. Não há retransmissão: se faltar pedaço,
 * a transferência falha e é preciso baixar de novo.
 */
export class TransferReceiver {
  readonly name: string
  readonly result: Promise<Uint8Array>

  private size: number
  private buf: Uint8Array
  private seen = new Set<number>()
  private received = 0
  private lastPacketAt = performance.now()
  private endAt = 0
  private done = false
  private timer: ReturnType<typeof setInterval>
  private onProgress: ((fraction: number) => void) | undefined
  private resolve: (data: Uint8Array) => void = () => {}
  private reject: (err: Error) => void = () => {}

  constructor(name: string, size: number, onProgress?: (fraction: number) => void) {
    this.name = name
    this.size = size
    this.buf = new Uint8Array(size)
    this.onProgress = onProgress
    this.result = new Promise<Uint8Array>((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
    // evita aviso de "unhandled rejection" se a falha vier antes de alguém aguardar
    this.result.catch(() => {})
    this.timer = setInterval(() => this.check(), 250)
  }

  /** O firmware informa o tamanho real no "xfer_start" (pode diferir da lista). */
  setSize(size: number): void {
    if (this.done || size === this.size || this.received > 0) return
    this.size = size
    this.buf = new Uint8Array(size)
  }

  /** Chegou o "xfer_end": o dispositivo terminou de enviar. */
  markEnd(): void {
    if (this.done) return
    this.endAt = performance.now()
    if (this.received >= this.size) this.finish()
  }

  push(dv: DataView): void {
    if (this.done || dv.byteLength <= OFFSET_BYTES) return
    const offset = dv.getUint32(0, true)
    const len = dv.byteLength - OFFSET_BYTES
    if (this.seen.has(offset) || offset + len > this.buf.length) return

    this.buf.set(new Uint8Array(dv.buffer, dv.byteOffset + OFFSET_BYTES, len), offset)
    this.seen.add(offset)
    this.received += len
    this.lastPacketAt = performance.now()
    if (this.size > 0) this.onProgress?.(Math.min(1, this.received / this.size))
    if (this.received >= this.size) this.finish()
  }

  fail(reason: string): void {
    if (this.done) return
    this.done = true
    clearInterval(this.timer)
    this.reject(new Error(reason))
  }

  private finish(): void {
    if (this.done) return
    this.done = true
    clearInterval(this.timer)
    this.resolve(this.buf)
  }

  private check(): void {
    if (this.done) return
    const now = performance.now()
    if (this.endAt && now - this.endAt > END_GRACE_MS) this.fail('pacotes perdidos')
    else if (now - this.lastPacketAt > IDLE_TIMEOUT_MS) this.fail('tempo esgotado')
  }
}

/**
 * Assina a characteristic de transferência do serviço de dados e entrega os
 * pacotes ao recebimento em andamento (um por vez).
 */
export class MpaTransfer {
  private server: BluetoothRemoteGATTServer
  private char: BluetoothRemoteGATTCharacteristic | null = null
  private current: TransferReceiver | null = null

  constructor(server: BluetoothRemoteGATTServer) {
    this.server = server
  }

  async subscribe(): Promise<void> {
    const { stream } = GATT.services
    const char = await getCharacteristic(this.server, stream.uuid, stream.characteristics.xfer)
    this.char = char
    char.addEventListener('characteristicvaluechanged', this.handlePacket)
    await char.startNotifications()
  }

  /** Prepara o recebimento de um arquivo. Chame ANTES de pedir o "get". */
  begin(name: string, size: number, onProgress?: (fraction: number) => void): TransferReceiver {
    this.current?.fail('substituída por uma nova transferência')
    const rx = new TransferReceiver(name, size, onProgress)
    this.current = rx
    return rx
  }

  dispose(): void {
    this.current?.fail('conexão encerrada')
    this.current = null
    this.char?.removeEventListener('characteristicvaluechanged', this.handlePacket)
    this.char = null
  }

  private handlePacket = (e: Event): void => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (value) this.current?.push(value)
  }
}