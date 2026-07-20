// Utilidades compartidas para la configuración de canales de chat.
// Reutilizadas por el visor de chats (Chats.tsx) y por el gestor del
// administrador (ChatsManager.tsx) para no duplicar la lógica de claves/estado.

export type ChatChannelKind = "team" | "family" | "broadcast" | "admins" | "coaches" | "staff";
export type ChatChannelStatus = "open" | "closed" | "archived";

export interface ChatChannelConfig {
  channel_key: string;
  kind: string;
  team_id: string | null;
  enabled: boolean;
  status: string;
}

// channel_key idéntico al usado como id de canal en el cliente.
export function channelKey(kind: ChatChannelKind, teamId?: string | null): string {
  if (kind === "team" || kind === "family") return `${kind}-${teamId}`;
  return kind; // broadcast · admins · coaches · staff (singleton)
}

// Estado efectivo de un canal según su configuración (ausencia = activo/abierto).
export interface EffectiveChannelState {
  enabled: boolean;
  status: ChatChannelStatus;
  writable: boolean; // enabled && status === 'open'
  visible: boolean; // enabled && status !== 'archived'
}

export function effectiveState(cfg?: ChatChannelConfig | null): EffectiveChannelState {
  const enabled = cfg ? cfg.enabled : true;
  const status = (cfg?.status as ChatChannelStatus) ?? "open";
  return {
    enabled,
    status,
    writable: enabled && status === "open",
    visible: enabled && status !== "archived",
  };
}

export const ROLE_CHANNEL_LABEL: Record<"admins" | "coaches" | "staff", string> = {
  admins: "Administradores",
  coaches: "Entrenadores",
  staff: "Staff",
};

export const STATUS_LABEL: Record<ChatChannelStatus, string> = {
  open: "Abierto",
  closed: "Cerrado (solo lectura)",
  archived: "Archivado",
};
