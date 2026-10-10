import ConnectDeviceDialog from '@/components/monitoring/ConnectDeviceDialog'
import { Button } from '@/components/ui/button'
import { SmartphoneNfc } from 'lucide-react'
import { useState } from 'react'


function Monitoring() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className='flex flex-1 flex-col items-center justify-center gap-4'>
        <SmartphoneNfc size={48} className='text-muted-foreground' />
        <Button type='button' onClick={() => setOpen(true)} className='rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/60 hover:cursor-pointer'>
          Conectar dispositivo 
        </Button>

        <ConnectDeviceDialog open={open} onOpenChange={setOpen} />
      </div>
    </>
  )
}

export default Monitoring
