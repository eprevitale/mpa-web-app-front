import { GATT, getCharacteristic } from '@/ble/gatt'
import { parseStatus, type MpaStatus } from '@/ble/mpaStatus'

export interface RecParams {
  athlete: string
  exercise: string
  loadKg: number
}

type StatusListener = (status: MpaStatus) => void

// O firmware limita o nome do atleta; aqui só tiramos acentos e o "|", que é
// o separador do protocolo. O firmware ainda higieniza o resto.
function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\|/g, ' ')
    .trim()
}

/**
 * Serviço de controle do MPA: envia comandos de texto e recebe o status do
 * dispositivo já interpretado (MpaStatus).
 *
 * - Os comandos são enfileirados: operações GATT do Web Bluetooth não podem
 *   rodar ao mesmo tempo.
 * - As characteristics ficam inválidas depois de uma desconexão; ao reconectar,
 *   crie uma instância nova (e chame dispose() na antiga).
 */
export class MpaControl {
  private server: BluetoothRemoteGATTServer
  private cmdChar: BluetoothRemoteGATTCharacteristic | null = null
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null
  private listeners = new Set<StatusListener>()
  private chain: Promise<unknown> = Promise.resolve()

  constructor(server: BluetoothRemoteGATTServer) {
    this.server = server
  }

  /** Registra um ouvinte de status. Devolve a função pra cancelar. */
  onStatus(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Assina o status, lê o estado atual e o devolve.
   * Operações GATT precisam ser sequenciais (um await por vez).
   */
  async init(): Promise<MpaStatus> {
    const { provisioning } = GATT.services

    this.cmdChar = await getCharacteristic(
      this.server,
      provisioning.uuid,
      provisioning.characteristics.commands,
    )

    const statusChar = await getCharacteristic(
      this.server,
      provisioning.uuid,
      provisioning.characteristics.status,
    )
    this.statusChar = statusChar
    statusChar.addEventListener('characteristicvaluechanged', this.handleStatus)
    await statusChar.startNotifications()

    const value = await statusChar.readValue()
    return parseStatus(new TextDecoder().decode(value))
  }

  // ---- comandos: modo ao vivo
  startLive(): Promise<void> {
    return this.write('start')
  }
  stopLive(): Promise<void> {
    return this.write('stop')
  }

  // ---- comandos: mapeamento (gravação no aparelho)
  async startRecording(p: RecParams): Promise<void> {
    const athlete = normalizeName(p.athlete)
    if (!athlete) throw new Error('Informe o nome do atleta.')
    const exercise = normalizeName(p.exercise)
    const load = Math.max(0, Math.min(999, Math.round(p.loadKg) || 0))
    await this.write(`rec|${athlete}|${exercise}|${load}`)
  }
  stopRecording(): Promise<void> {
    return this.write('recstop')
  }

  // ---- comandos: arquivos salvos no aparelho
  requestList(): Promise<void> {
    return this.write('list')
  }
  requestFile(name: string): Promise<void> {
    return this.write(`get|${name}`)
  }
  deleteFile(name: string): Promise<void> {
    return this.write(`del|${name}`)
  }

  dispose(): void {
    this.statusChar?.removeEventListener('characteristicvaluechanged', this.handleStatus)
    this.statusChar = null
    this.cmdChar = null
    this.listeners.clear()
  }

  // A characteristic de comando é só WRITE (com resposta).
  private write(text: string): Promise<void> {
    const char = this.cmdChar
    if (!char) return Promise.reject(new Error('MpaControl não inicializado'))
    const run = () => char.writeValueWithResponse(new TextEncoder().encode(text))
    const p = this.chain.catch(() => undefined).then(run)
    this.chain = p
    return p
  }

  private handleStatus = (e: Event): void => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (!value) return
    const status = parseStatus(new TextDecoder().decode(value))
    this.listeners.forEach((listener) => listener(status))
  }
}