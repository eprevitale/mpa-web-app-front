import type { MpaControl } from '@/ble/mpaControl'
import type { MpaTransfer } from '@/ble/mpaTransfer'
import type { MpaStatus } from '@/ble/mpaStatus'

export interface DeviceFile {
  name: string
  size: number
  count: number
  missed: number
  athlete: string
  exercise: string
}

export interface DeviceFileList {
  /** bytes usados / total na memória do aparelho */
  used: number
  total: number
  files: DeviceFile[]
}

const REQUEST_TIMEOUT_MS = 4000

/**
 * Operações sobre os arquivos de sessão salvos no aparelho (list / get / del),
 * transformando o protocolo de comandos + status em promessas.
 *
 * O firmware só atende esses comandos com o aparelho parado (sem gravar e
 * sem modo ao vivo); fora disso ele simplesmente não responde, e a promessa
 * falha por tempo esgotado.
 */
export class MpaSessions {
  private control: MpaControl
  private transfer: MpaTransfer
  private listInFlight: Promise<DeviceFileList> | null = null

  constructor(control: MpaControl, transfer: MpaTransfer) {
    this.control = control
    this.transfer = transfer
  }

  list(): Promise<DeviceFileList> {
    // Duas listagens simultâneas receberiam as mensagens uma da outra
    if (this.listInFlight) return this.listInFlight

    const files: DeviceFile[] = []
    let used = 0
    let total = 0

    const promise = this.request<DeviceFileList>(
      () => this.control.requestList(),
      (s, done) => {
        if (s.type === 'fs') {
          used = s.used
          total = s.total
        } else if (s.type === 'file') {
          files.push({
            name: s.name,
            size: s.size,
            count: s.count,
            missed: s.missed,
            athlete: s.athlete,
            exercise: s.exercise,
          })
        } else if (s.type === 'list_end') {
          done({ used, total, files })
        }
      },
      'Sem resposta do aparelho. Ele pode estar gravando ou em modo ao vivo.',
    ).finally(() => {
      this.listInFlight = null
    })
    this.listInFlight = promise
    return promise
  }

  remove(name: string): Promise<void> {
    return this.request<void>(
      () => this.control.deleteFile(name),
      (s, done, fail) => {
        if (s.type === 'del_ok' && s.name === name) done()
        else if (s.type === 'del_error' && s.name === name) {
          fail(new Error(`Não foi possível apagar ${name}.`))
        }
      },
      'Sem resposta do aparelho ao apagar.',
    )
  }

  /** Baixa o arquivo inteiro. onProgress recebe um valor de 0 a 1. */
  async download(file: DeviceFile, onProgress?: (fraction: number) => void): Promise<Uint8Array> {
    if (file.size <= 0) throw new Error('Arquivo vazio ou inválido no aparelho.')

    // O recebimento precisa existir antes do "get", senão perde o início.
    const rx = this.transfer.begin(file.name, file.size, onProgress)
    const off = this.control.onStatus((s) => {
      if (s.type === 'xfer_start' && s.name === file.name) rx.setSize(s.size)
      else if (s.type === 'xfer_end' && s.name === file.name) rx.markEnd()
      else if (s.type === 'get_error' && s.name === file.name) {
        rx.fail('o aparelho não encontrou o arquivo')
      }
    })

    try {
      await this.control.requestFile(file.name)
    } catch (e) {
      rx.fail(e instanceof Error ? e.message : 'erro BLE')
    }

    try {
      return await rx.result
    } finally {
      off()
    }
  }

  /**
   * Envia um comando e espera a resposta nos status. O prazo é renovado a
   * cada status recebido (a lista, por exemplo, chega em várias mensagens).
   */
  private request<T>(
    send: () => Promise<void>,
    onStatus: (s: MpaStatus, done: (value: T) => void, fail: (err: Error) => void) => void,
    timeoutMessage: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let off: () => void = () => {}
      let timer: ReturnType<typeof setTimeout> | undefined

      const cleanup = () => {
        clearTimeout(timer)
        off()
      }
      const arm = () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          cleanup()
          reject(new Error(timeoutMessage))
        }, REQUEST_TIMEOUT_MS)
      }
      const done = (value: T) => {
        cleanup()
        resolve(value)
      }
      const fail = (err: Error) => {
        cleanup()
        reject(err)
      }

      off = this.control.onStatus((s) => {
        arm()
        onStatus(s, done, fail)
      })
      arm()
      send().catch((e) => fail(e instanceof Error ? e : new Error(String(e))))
    })
  }
}