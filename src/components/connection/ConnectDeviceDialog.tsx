import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useMpa } from "@/context/mpaContext";
import { Button } from "../ui/button";
import { CircleCheck } from "lucide-react";

interface ConnectDeviceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void
}

export default function ConnectDeviceDialog({
    open,
    onOpenChange
}: ConnectDeviceDialogProps) {

    const { status, error, connect } = useMpa()
    
    return(
        <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle>Conectar dispositivo</DialogTitle>
            <DialogDescription>
                {status === 'connecting' && <p>Selecione o MPA na janela do navegador…</p>}

                {status === 'connected' && (
                <>
                    <CircleCheck />
                    <p className="mt-2">Conectado!</p>
                </>
                )}

                {status === 'idle' && (
                <>
                    <p className="mt-2">Nenhum dispositivo selecionado.</p>
                    <Button onClick={() => void connect()} className="mt-4">Tentar novamente</Button>
                </>
                )}

                {status === 'error' && (
                <>
                    <p className="mt-2">{error}</p>
                    <Button onClick={() => void connect()} className="mt-4">Tentar novamente</Button>
                </>
                )}
            </DialogDescription>
            </DialogHeader>
        </DialogContent>
        </Dialog>
    )
}