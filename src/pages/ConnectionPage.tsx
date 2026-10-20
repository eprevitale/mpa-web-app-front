import ConnectDeviceDialog from '@/components/connection/ConnectDeviceDialog'
import { Button } from '@/components/ui/button'
import { useMpa } from '@/context/mpaContext'
import { CircleCheck, SmartphoneNfc } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function ConnectionPage() {
  const [open, setOpen] = useState(false)
  const { status, connect } = useMpa()
  const navigate = useNavigate()

  async function handleConnect() {
    setOpen(true)
    const ok = await connect()
    if (ok) {
      setOpen(false)
      navigate('/monitoring')
    }
  }

  return (
    <>
      <div className='flex flex-1 flex-col items-center justify-center gap-4'>

        {status === 'connected' && (
        <>
            <CircleCheck size={48} className='text-muted-foreground' />
            <p className="mt-2">Conectado!</p>
            <Button
              type='button'
              onClick={handleConnect}
              className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/60 hover:cursor-pointer'
            >
              Conectar outro dispositivo
            </Button>
            <ConnectDeviceDialog open={open} onOpenChange={setOpen} />
        </>
        )}

        {status !== 'connected' && (
        <>
          <SmartphoneNfc size={48} className='text-muted-foreground' />
          <Button
            type='button'
            onClick={handleConnect}
            className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/60 hover:cursor-pointer'
          >
            Conectar dispositivo
          </Button>
          <ConnectDeviceDialog open={open} onOpenChange={setOpen} />
        </>
        )}
        
      </div>
    </>
  )
}

export default ConnectionPage