/* eslint-disable greendex/no-hardcoded-ui-copy -- Mock sidebar labels; real i18n wiring follows after layout debate. */
"use client";

import {
  Building2Icon,
  ChevronsUpDownIcon,
  ClipboardCheckIcon,
  FolderIcon,
  PaletteIcon,
  PlusIcon,
  ReceiptTextIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";

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
  SidebarRail,
} from "@/components/ui/sidebar";

const workspaceItems = [
  { icon: FolderIcon, label: "Projects", active: true },
  { icon: ClipboardCheckIcon, label: "Claim review", active: false },
  { icon: UsersIcon, label: "Partner organizations", active: false },
];

const manageItems = [
  { icon: Building2Icon, label: "Organization", active: false },
  { icon: Settings2Icon, label: "User settings", active: false },
];

const shortcutItems = [
  { icon: PlusIcon, label: "New project", active: false },
  { icon: ReceiptTextIcon, label: "New claim", active: false },
];

const systemItems = [
  { icon: PaletteIcon, label: "Design system", active: false },
];

function MockGroup({
  label,
  items,
}: {
  label: string;
  items: { icon: typeof FolderIcon; label: string; active: boolean }[];
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton isActive={item.active} tooltip={item.label}>
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Organization">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2Icon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm/tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">GreenDex Org</span>
                <span className="truncate text-xs">Erasmus Edition</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <MockGroup label="Workspace" items={workspaceItems} />
        <MockGroup label="Manage" items={manageItems} />
        <MockGroup label="Shortcuts" items={shortcutItems} />
        <MockGroup label="System" items={systemItems} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Account">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary">
                JD
              </div>
              <div className="grid flex-1 text-left text-sm/tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">Jane Doe</span>
                <span className="truncate text-xs">jane@example.org</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
