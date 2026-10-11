const uuid_suffix = "-8f3a-4c1e-9b7a-0a1b2c3d4e5f"

// services
const svc_provisioning = "6d500010"+uuid_suffix
const svc_stream       = "6d500020"+uuid_suffix

// characteristics
const chr_cmd    = "6d500011"+uuid_suffix
const chr_status = "6d500012"+uuid_suffix
const chr_imu    = "6d500021"+uuid_suffix

export const GATT = {
  deviceNamePrefix: 'MPA',
  services: {
    stream: {
      uuid: svc_stream,
      characteristics: {
        imu: chr_imu, // notify
      },
    },
    provisioning: {
      uuid: svc_provisioning,
      characteristics: {
        commands: chr_cmd,
        status: chr_status,
      },
    },
  },
} as const

export const ALL_SERVICE_UUIDS = Object.values(GATT.services).map((s) => s.uuid)

export async function getCharacteristic(
  server: BluetoothRemoteGATTServer,
  serviceUuid: string,
  characteristicUuid: string,
) {
  const service = await server.getPrimaryService(serviceUuid)
  return service.getCharacteristic(characteristicUuid)
}