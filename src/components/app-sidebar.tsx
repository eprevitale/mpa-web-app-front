import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Activity } from "lucide-react"
import { useNavigate } from "react-router-dom"

export function AppSidebar() {

const navigate = useNavigate()

  return (
    <Sidebar>
      <SidebarHeader className="mx-2 py-4">
        <span className="">Monitor de Performance Atlética</span>
      </SidebarHeader>
      <SidebarContent className="mx-2">
        <SidebarMenu />
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => navigate('/')} className="px-4 hover:cursor-pointer">
              <Activity />
              <span>Monitoramento</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}