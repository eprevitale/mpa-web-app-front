// Formato do arquivo de sessão (.bin) gravado pelo firmware:
//   cabeçalho (64 bytes na versão 1, 68 bytes na versão 2) + amostras de 12 bytes
//   (gx, gy, gz, ax, ay, az em int16 little-endian, valores BRUTOS, 400 Hz).
// O offset do giroscópio medido na calibração fica no cabeçalho e NÃO é
// subtraído dos dados.
//
// Escalas dos valores brutos: acelerômetro ±8 g = 4096 LSB/g;
// giroscópio ±2000 °/s = 16,4 LSB/(°/s).

export const HEADER_V1_BYTES = 64
export const HEADER_V2_BYTES = 68
export const SAMPLE_BYTES = 12

export const ACC_LSB_PER_G = 4096
export const GYR_LSB_PER_DPS = 16.4

/** Índice de cada canal em Session.ch */
export const CHANNEL = { gx: 0, gy: 1, gz: 2, ax: 3, ay: 4, az: 5 } as const

export interface SessionHeader {
  version: number
  headerSize: number
  sampleBytes: number
  rateHz: number
  count: number
  missed: number
  crc: number
  bootMs: number
  gyroOff: [number, number, number]
  accRange: number
  gyrRange: number
  athlete: string
  exercise: string
  /** só existe na versão 2; na versão 1 vale 0 */
  loadKg: number
}

export interface Session {
  name: string
  header: SessionHeader
  /** número de amostras */
  n: number
  /** 6 canais, na ordem de CHANNEL, em valores brutos (LSB) */
  ch: Int16Array[]
  crcOk: boolean
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

/** Devolve null se o arquivo não for um .bin válido do MPA. */
export function parseSession(buf: Uint8Array, name: string): Session | null {
  if (buf.length < HEADER_V1_BYTES) return null

  const magic = String.fromCharCode(buf[0], buf[1], buf[2], buf[3])
  if (magic !== 'MPA1') return null

  const version = buf[4]
  const headerSize = version === 2 ? HEADER_V2_BYTES : HEADER_V1_BYTES
  if (buf.length < headerSize) return null

  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const text = (offset: number, length: number): string =>
    new TextDecoder().decode(buf.subarray(offset, offset + length)).split('\0')[0]

  const header: SessionHeader = {
    version,
    headerSize,
    sampleBytes: buf[5],
    rateHz: dv.getUint16(6, true),
    count: dv.getUint32(8, true),
    missed: dv.getUint32(12, true),
    crc: dv.getUint32(16, true),
    bootMs: dv.getUint32(20, true),
    gyroOff: [dv.getInt16(24, true), dv.getInt16(26, true), dv.getInt16(28, true)],
    accRange: buf[30],
    gyrRange: buf[31],
    athlete: text(32, 20),
    exercise: text(52, 12),
    loadKg: version === 2 ? dv.getUint16(64, true) : 0,
  }

  if (header.sampleBytes !== SAMPLE_BYTES) return null

  const n = Math.floor((buf.length - headerSize) / SAMPLE_BYTES)
  if (n !== header.count) return null

  const data = buf.subarray(headerSize, headerSize + n * SAMPLE_BYTES)
  const crcOk = crc32(data) === header.crc

  const ch = [0, 1, 2, 3, 4, 5].map(() => new Int16Array(n))
  for (let i = 0; i < n; i++) {
    const base = headerSize + i * SAMPLE_BYTES
    for (let c = 0; c < 6; c++) {
      ch[c][i] = dv.getInt16(base + c * 2, true)
    }
  }

  return { name, header, n, ch, crcOk }
}