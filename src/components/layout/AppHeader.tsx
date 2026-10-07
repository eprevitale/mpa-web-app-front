import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

interface AppHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  leading?: ReactNode
  actions?: ReactNode
  className?: string
}

export default function AppHeader({
  title,
  subtitle,
  onBack,
  leading,
  actions,
  className = "",
}: AppHeaderProps) {
  return (
    <header
      className={`flex h-[70px] shrink-0 items-center justify-between gap-4 border-b border-border bg-background px-6 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {leading}

        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <ArrowLeft size={16} strokeWidth={2} />
          </button>
        )}

        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="truncate text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </header>
  )
}