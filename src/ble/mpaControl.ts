import { GATT, getCharacteristic } from '@/ble/gatt'

export type MpaCommand = 'start' | 'stop'

/**
 * Serviço de controle do MPA: envia comandos e recebe o status do dispositivo
 * (texto: "idle", "recording", "imu_error"...).
 *
 * As characteristics ficam inválidas depois de uma desconexão; ao reconectar,
 * crie uma instância nova (e chame dispose() na antiga).
 */
export class MpaControl {
  private server: BluetoothRemoteGATTServer
  private onStatus: (status: string) => void
  private cmdChar: BluetoothRemoteGATTCharacteristic | null = null
  private statusChar: BluetoothRemoteGATTCharacteristic | null = null

  constructor(server: BluetoothRemoteGATTServer, onStatus: (status: string) => void) {
    this.server = server
    this.onStatus = onStatus
  }

  async init(): Promise<string> {
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
    const current = new TextDecoder().decode(value)
    this.onStatus(current)
    return current
  }

  async send(cmd: MpaCommand): Promise<void> {
    if (!this.cmdChar) throw new Error('MpaControl não inicializado')
    await this.cmdChar.writeValueWithResponse(new TextEncoder().encode(cmd))
  }

  dispose(): void {
    this.statusChar?.removeEventListener('characteristicvaluechanged', this.handleStatus)
    this.statusChar = null
    this.cmdChar = null
  }

  private handleStatus = (e: Event): void => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (value) this.onStatus(new TextDecoder().decode(value))
  }
}