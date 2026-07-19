import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardList, Magnet, Building2, Users } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Registros", url: "/registros", icon: ClipboardList },
  { title: "Ímãs", url: "/imas", icon: Magnet },
  { title: "Setores", url: "/setores", icon: Building2 },
  { title: "Usuários", url: "/usuarios", icon: Users },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 40 40" className="h-9 w-9 shrink-0" aria-hidden="true">
            <rect width="40" height="40" rx="9" fill="var(--color-accent)" />
            <text
              x="20"
              y="27"
              textAnchor="middle"
              fontFamily="system-ui, sans-serif"
              fontWeight="700"
              fontSize="16"
              fill="var(--color-accent-foreground)"
            >
              NM
            </text>
          </svg>
          <span className="truncate font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            Nutrimilho
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(item.url)}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3" />
    </Sidebar>
  );
}
