import Dexie, { type Table } from 'dexie'
import { parseSession, type Session } from '@/sessions/parseSession'

// Metadados de cada sessão baixada (leves, usados pra listar)
export interface StoredSessionMeta {
  id: string
  name: string
  size: number
  count: number
  athlete: string
  exercise: string
  loadKg: number
  rateHz: number
  missed: number
  downloadedAt: number
}

// Bytes do .bin original, em tabela separada pra a lista não carregar tudo
interface StoredRaw {
  id: string
  raw: Uint8Array
}

const db = new Dexie('mpa') as Dexie & {
  sessions: Table<StoredSessionMeta, string>
  raws: Table<StoredRaw, string>
}
db.version(1).stores({
  sessions: 'id, name, downloadedAt',
  raws: 'id',
})

// O nome do arquivo pode se repetir entre aparelhos ou depois de apagar e
// regravar; o CRC no id evita sobrescrever uma sessão diferente.
export const sessionId = (name: string, crc: number): string => `${name}#${crc.toString(16)}`

export async function saveSession(session: Session, raw: Uint8Array): Promise<void> {
  const h = session.header
  const id = sessionId(session.name, h.crc)
  const meta: StoredSessionMeta = {
    id,
    name: session.name,
    size: raw.length,
    count: h.count,
    athlete: h.athlete,
    exercise: h.exercise,
    loadKg: h.loadKg,
    rateHz: h.rateHz,
    missed: h.missed,
    downloadedAt: Date.now(),
  }
  await db.transaction('rw', db.sessions, db.raws, async () => {
    await db.sessions.put(meta)
    await db.raws.put({ id, raw })
  })
}

/** Procura uma sessão já baixada com o mesmo nome, tamanho e nº de amostras. */
export async function findCached(
  name: string,
  size: number,
  count: number,
): Promise<StoredSessionMeta | undefined> {
  const rows = await db.sessions.where('name').equals(name).toArray()
  return rows.find((r) => r.size === size && r.count === count)
}

/** Sessões guardadas neste navegador, da mais recente pra mais antiga. */
export function listStored(): Promise<StoredSessionMeta[]> {
  return db.sessions.orderBy('downloadedAt').reverse().toArray()
}

export async function loadStoredSession(id: string): Promise<Session | null> {
  const [meta, row] = await Promise.all([db.sessions.get(id), db.raws.get(id)])
  if (!meta || !row) return null
  return parseSession(row.raw, meta.name)
}

export async function removeStored(id: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.raws, async () => {
    await db.sessions.delete(id)
    await db.raws.delete(id)
  })
}