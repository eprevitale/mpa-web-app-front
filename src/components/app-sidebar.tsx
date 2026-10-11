import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Activity, Bluetooth, Home } from "lucide-react"
import { useNavigate } from "react-router-dom"
import logo from "/mpa_azul.jpg"

export function AppSidebar() {
  const navigate = useNavigate()

  return (
    <Sidebar>
      <SidebarHeader className="mx-2 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="MPA" className="h-8 w-auto" />
          <span className="text-sm font-medium leading-tight">
            Monitor de Performance Atlética
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="mx-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate('/')} className="px-4 hover:cursor-pointer">
              <Home />
              <span>Início</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate('/devices')} className="px-4 hover:cursor-pointer">
              <Bluetooth />
              <span>Dispositivos</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate('/monitoring')} className="px-4 hover:cursor-pointer">
              <Activity />
              <span>Monitoramento</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter />
    </Sidebar>
  )
}