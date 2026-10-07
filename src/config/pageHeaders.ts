export interface PageHeaderConfig {
  path: string;
  title: string
  subtitle?: string
  showBack?: boolean
}

export const pageHeaders: PageHeaderConfig[] = [
  {
    path: "/",
    title: "Monitor de Performance Atlética",
    subtitle: "Acompanhe suas métricas em tempo real",
  },
]