import { ALL_SERVICE_UUIDS, GATT } from './gatt'

export class MpaBle {
  private device: BluetoothDevice | null = null
  private onDisconnect: () => void

  constructor(onDisconnect: () => void) {
    this.onDisconnect = onDisconnect
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  /** true se já existe um dispositivo pareado nesta sessão da página */
  get hasDevice(): boolean {
    return this.device !== null
  }

  async connect(): Promise<{ server: BluetoothRemoteGATTServer; name: string }> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: GATT.deviceNamePrefix }],
      optionalServices: ALL_SERVICE_UUIDS,
    })

    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    }
    this.device = device
    device.addEventListener('gattserverdisconnected', this.handleDisconnect)

    const server = await device.gatt!.connect()
    return { server, name: device.name ?? 'MPA' }
  }

  async reconnect(): Promise<BluetoothRemoteGATTServer> {
    const gatt = this.device?.gatt
    if (!gatt) throw new Error('Nenhum dispositivo pareado nesta sessão')
    return gatt.connect()
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect()
  }

  private handleDisconnect = (): void => {
    this.onDisconnect()
  }
}