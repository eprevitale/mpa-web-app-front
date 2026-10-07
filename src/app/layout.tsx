import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { matchPath, Outlet, useLocation, useNavigate } from "react-router-dom"
import AppHeader from "@/components/layout/AppHeader"
import { pageHeaders } from "@/config/pageHeaders"

export default function Layout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const config = pageHeaders.find((h) => matchPath(h.path, pathname))

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader 
          title={config?.title ?? "Monitor de Performance Atlética"}
          subtitle={config?.subtitle}
          onBack={config?.showBack ? () => navigate(-1) : undefined}
          leading={<SidebarTrigger />}
        />
        <div>
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}