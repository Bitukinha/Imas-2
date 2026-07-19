import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
            <SidebarTrigger />
            <div className="leading-tight">
              <div className="text-sm font-medium text-foreground">Controle de Limpeza de Ímã</div>
              <div className="text-xs text-muted-foreground">
                FOR-RQ-001.03 • Rev. 00 • 1x por turno
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
          <footer className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Nutrimilho - (Novaes Tech) | Todos os direitos reservados
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
