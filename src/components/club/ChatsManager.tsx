import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Trash2,
  RefreshCw,
  Megaphone,
  ShieldCheck,
  Dumbbell,
  Briefcase,
  Users,
  Baby,
} from "lucide-react";
import { toast } from "sonner";
import {
  channelKey,
  effectiveState,
  type ChatChannelConfig,
  type ChatChannelKind,
  type ChatChannelStatus,
} from "@/lib/chatChannels";

interface TeamRow {
  id: string;
  name: string;
  age_category: string | null;
}

// Descriptor de un canal gestionable (fila del gestor).
interface ManagedChannel {
  key: string;
  kind: ChatChannelKind;
  teamId: string | null;
  label: string;
  icon: typeof Users;
}

const isU12 = (t: TeamRow) => (t.age_category ?? "U14+") === "U12";

export function ChatsManager() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [config, setConfig] = useState<Map<string, ChatChannelConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ManagedChannel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: teamsData }, { data: cfgData }] = await Promise.all([
      supabase.from("teams").select("id, name, age_category").order("name"),
      supabase.from("chat_channels").select("channel_key, kind, team_id, enabled, status"),
    ]);
    setTeams((teamsData ?? []) as TeamRow[]);
    const map = new Map<string, ChatChannelConfig>();
    ((cfgData ?? []) as ChatChannelConfig[]).forEach((c) => map.set(c.channel_key, c));
    setConfig(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Canales generales (no ligados a equipo) + canales de rol.
  const globalChannels: ManagedChannel[] = [
    {
      key: channelKey("broadcast"),
      kind: "broadcast",
      teamId: null,
      label: "Canal de Difusión",
      icon: Megaphone,
    },
    {
      key: channelKey("admins"),
      kind: "admins",
      teamId: null,
      label: "Administradores",
      icon: ShieldCheck,
    },
    {
      key: channelKey("coaches"),
      kind: "coaches",
      teamId: null,
      label: "Entrenadores",
      icon: Dumbbell,
    },
    { key: channelKey("staff"), kind: "staff", teamId: null, label: "Staff", icon: Briefcase },
  ];

  // Persiste (upsert) la configuración de un canal.
  const saveChannel = async (
    ch: ManagedChannel,
    patch: { enabled?: boolean; status?: ChatChannelStatus },
  ) => {
    const current = config.get(ch.key);
    const next = {
      channel_key: ch.key,
      kind: ch.kind,
      team_id: ch.teamId,
      enabled: patch.enabled ?? current?.enabled ?? true,
      status: (patch.status ?? current?.status ?? "open") as string,
    };
    setBusyKey(ch.key);
    const { error } = await supabase
      .from("chat_channels")
      .upsert(next, { onConflict: "channel_key" });
    setBusyKey(null);
    if (error) {
      toast.error("No se pudo guardar la configuración del chat");
      return;
    }
    setConfig((prev) => {
      const m = new Map(prev);
      m.set(ch.key, next as ChatChannelConfig);
      return m;
    });
  };

  // Elimina el chat: borra el historial de mensajes y lo desactiva.
  const deleteChannel = async (ch: ManagedChannel) => {
    setBusyKey(ch.key);
    let del = supabase.from("team_messages").delete().eq("channel_type", ch.kind);
    del = ch.teamId ? del.eq("team_id", ch.teamId) : del.is("team_id", null);
    const { error: delErr } = await del;
    if (delErr) {
      setBusyKey(null);
      toast.error("No se pudieron eliminar los mensajes del chat");
      return;
    }
    const row = {
      channel_key: ch.key,
      kind: ch.kind,
      team_id: ch.teamId,
      enabled: false,
      status: "open",
    };
    const { error: cfgErr } = await supabase
      .from("chat_channels")
      .upsert(row, { onConflict: "channel_key" });
    setBusyKey(null);
    if (cfgErr) {
      toast.error("Mensajes borrados, pero no se pudo actualizar el estado del chat");
      return;
    }
    setConfig((prev) => {
      const m = new Map(prev);
      m.set(ch.key, row as ChatChannelConfig);
      return m;
    });
    toast.success("Chat eliminado (historial borrado y desactivado)");
  };

  const renderRow = (ch: ManagedChannel) => {
    const st = effectiveState(config.get(ch.key));
    const Icon = ch.icon;
    const busy = busyKey === ch.key;
    return (
      <div
        key={ch.key}
        className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{ch.label}</span>
          {!st.enabled && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              inactivo
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {st.enabled ? "Activo" : "Inactivo"}
            </span>
            <Switch
              checked={st.enabled}
              disabled={busy}
              onCheckedChange={(v) => saveChannel(ch, { enabled: v })}
              aria-label={`Activar chat ${ch.label}`}
            />
          </div>
          <Select
            value={st.status}
            disabled={busy || !st.enabled}
            onValueChange={(v) => saveChannel(ch, { status: v as ChatChannelStatus })}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Abierto</SelectItem>
              <SelectItem value="closed">Cerrado</SelectItem>
              <SelectItem value="archived">Archivado</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            disabled={busy}
            onClick={() => setPendingDelete(ch)}
            aria-label={`Eliminar chat ${ch.label}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-black">Gestión de chats</h3>
          <p className="text-xs text-muted-foreground">
            Activa o desactiva cada chat, ciérralo (solo lectura), archívalo o elimínalo.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">Cargando chats...</div>
      ) : (
        <>
          <Card className="p-4">
            <h4 className="mb-1 text-sm font-bold">Canales generales</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              Difusión y chats por rol (Administradores, Entrenadores, Staff).
            </p>
            {globalChannels.map(renderRow)}
          </Card>

          <Card className="p-4">
            <h4 className="mb-1 text-sm font-bold">Chats por equipo y familia</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              Cada equipo dispone de un chat de equipo (jugadores) y un chat de familias. Los
              equipos U12 solo tienen chat de familias.
            </p>
            {teams.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay equipos creados aún.
              </p>
            ) : (
              <div className="space-y-4">
                {teams.map((t) => {
                  const teamCh: ManagedChannel = {
                    key: channelKey("team", t.id),
                    kind: "team",
                    teamId: t.id,
                    label: `Equipo · ${t.name}`,
                    icon: Users,
                  };
                  const familyCh: ManagedChannel = {
                    key: channelKey("family", t.id),
                    kind: "family",
                    teamId: t.id,
                    label: `Familias · ${t.name}`,
                    icon: Baby,
                  };
                  return (
                    <div key={t.id} className="rounded-lg border border-border p-3">
                      <div className="mb-1 text-sm font-semibold">
                        {t.name}
                        {isU12(t) && (
                          <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                            U12
                          </span>
                        )}
                      </div>
                      {!isU12(t) && renderRow(teamCh)}
                      {renderRow(familyCh)}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar chat</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará permanentemente el historial de «{pendingDelete?.label}» y el chat quedará
              desactivado. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) deleteChannel(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
