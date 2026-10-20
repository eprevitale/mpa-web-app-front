import type { DeviceFile, MpaSessions } from '@/ble/mpaSessions'
import { parseSession, type Session } from '@/sessions/parseSession'
import { findCached, loadStoredSession, saveSession } from '@/sessions/sessionStore'

/**
 * Devolve a sessão pedida:
 * 1. se já foi baixada antes (mesmo nome, tamanho e nº de amostras), lê do
 *    IndexedDB sem usar o BLE;
 * 2. senão baixa do aparelho, valida o CRC e guarda localmente.
 */
export async function loadSession(
  file: DeviceFile,
  sessions: MpaSessions,
  onProgress?: (fraction: number) => void,
): Promise<Session> {
  const cached = await findCached(file.name, file.size, file.count)
  if (cached) {
    const session = await loadStoredSession(cached.id)
    if (session?.crcOk) return session
  }

  const raw = await sessions.download(file, onProgress)

  const session = parseSession(raw, file.name)
  if (!session) throw new Error('Arquivo inválido.')
  if (!session.crcOk) throw new Error('CRC não confere. Baixe de novo.')

  await saveSession(session, raw)
  return session
}