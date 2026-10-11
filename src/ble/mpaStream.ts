import { GATT, getCharacteristic } from '@/ble/gatt'

export class MpaStream {
  private server: BluetoothRemoteGATTServer
  private onData: (data: DataView) => void
  private char: BluetoothRemoteGATTCharacteristic | null = null

  constructor(server: BluetoothRemoteGATTServer, onData: (data: DataView) => void) {
    this.server = server
    this.onData = onData
  }

  async subscribe(): Promise<void> {
    const { stream } = GATT.services
    const char = await getCharacteristic(
        this.server,
        stream.uuid,
        stream.characteristics.imu,
    )
    this.char = char
    char.addEventListener('characteristicvaluechanged', this.handleValue)
    await char.startNotifications()
  }

  /** Cancela a assinatura (só faz sentido enquanto conectado). */
  async unsubscribe(): Promise<void> {
    const char = this.char
    if (!char) return
    try {
      if (this.server.connected) await char.stopNotifications()
    } finally {
      this.dispose()
    }
  }

  /** Remove o listener sem falar com o dispositivo (use após desconexão). */
  dispose(): void {
    this.char?.removeEventListener('characteristicvaluechanged', this.handleValue)
    this.char = null
  }

  private handleValue = (e: Event): void => {
    const value = (e.target as BluetoothRemoteGATTCharacteristic).value
    if (value) this.onData(value)
  }
}