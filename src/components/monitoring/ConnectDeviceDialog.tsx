import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ConnectDeviceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void
}

export default function ConnectDeviceDialog({
    open,
    onOpenChange
}: ConnectDeviceDialogProps) {
    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Conectar dispositivo</DialogTitle>
            <DialogDescription>
                Selecione um dispositivo MPA para conectar:
            </DialogDescription>
            </DialogHeader>
        </DialogContent>
        </Dialog>
    )
}