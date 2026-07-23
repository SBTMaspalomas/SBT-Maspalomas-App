import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Megaphone, Users, Baby, MessageSquareLock, Lock, ShieldAlert, ShieldCheck, Dumbbell, Briefcase } from "lucide-react";
import { channelKey, effectiveState, type ChatChannelConfig } from "@/lib/chatChannels";

type ChannelKind = "team" | "family" | "broadcast" | "private" | "admins" | "coaches" | "staff";

interface Channel {
  id: string;
  label: string;
  icon: typeof Users;
  kind: ChannelKind;
  teamId?: string;
  familyId?: string; // private (admin<->family)
  familyLabel?: string;
  canWrite: boolean;
  readOnlyReason?: string; // e.g. canal cerrado por el administrador
  restricted?: string; // reason if restricted (e.g. U12)
}

interface TeamRow { id: string; name: string; category: string; age_category: string | null }
interface PlayerRow { id: string; full_name: string; team_id: string | null; family_id: string | null }
interface FamilyRow { id: string; reference_code: string | null; head_profile_id: string | null; head_email: string | null }
interface GroupMsg { id: string; channel_type: "team" | "family" | "broadcast"; team_id: string | null; sender_id: string; sender_name: string; message_text: string; created_at: string }
interface PrivateMsg { id: string; sender_id: string; receiver_family_id: string; message_text: string; is_read: boolean; created_at: string }

const isU12 = (t?: TeamRow) => (t?.age_category ?? "U14+") === "U12";

interface ChatsProps {
  /** Familia cuyo chat privado debe abrirse al montar (lo dispara el admin desde Miembros). */
  initialPrivateFamilyId?: string | null;
  /** Se llama cuando el chat privado solicitado ya se ha seleccionado. */
  onConsumedPrivateChat?: () => void;
}

export function Chats({ initialPrivateFamilyId, onConsumedPrivateChat }: ChatsProps = {}) {
  const { user, role, roles, fullName, family, activeProfile } = useAuth();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [families, setFamilies] = useState<FamilyRow[]>([]);
  const [coachTeamIds, setCoachTeamIds] = useState<string[]>([]);
  const [channelConfig, setChannelConfig] = useState<Map<string, ChatChannelConfig>>(new Map());
  const [groupMsgs, setGroupMsgs] = useState<GroupMsg[]>([]);
  const [privateMsgs, setPrivateMsgs] = useState<PrivateMsg[]>([]);
  const [active, setActive] = useState<string>("");
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isChildProfile = role === "family" && activeProfile?.kind === "child";
  const isAdultFamily = role === "family" && activeProfile?.kind === "adult";
  const currentChildId = isChildProfile && activeProfile.kind === "child" ? activeProfile.childId : null;

  // Load reference data
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [teamsR, playersR, familiesR, coachR, configR] = await Promise.all([
        supabase.from("teams").select("id, name, category, age_category").order("name"),
        supabase.from("players").select("id, full_name, team_id, family_id"),
        role === "admin"
          ? supabase.from("families_meta").select("id, reference_code, head_profile_id, head_email").order("reference_code")
          : Promise.resolve({ data: [], error: null } as { data: FamilyRow[]; error: null }),
        role === "coach"
          ? supabase.from("coach_teams").select("team_id").eq("user_id", user.id)
          : Promise.resolve({ data: [], error: null } as { data: { team_id: string }[]; error: null }),
        supabase.from("chat_channels").select("channel_key, kind, team_id, enabled, status"),
      ]);
      if (!active) return;
      setTeams((teamsR.data ?? []) as TeamRow[]);
      setPlayers((playersR.data ?? []) as PlayerRow[]);
      setFamilies((familiesR.data ?? []) as FamilyRow[]);
      setCoachTeamIds(((coachR.data ?? []) as { team_id: string }[]).map((r) => String(r.team_id)));
      const cfgMap = new Map<string, ChatChannelConfig>();
      ((configR.data ?? []) as ChatChannelConfig[]).forEach((c) => cfgMap.set(c.channel_key, c));
      setChannelConfig(cfgMap);
    })();
    return () => { active = false; };
  }, [user, role]);

  // Build channel list
  const channels = useMemo<Channel[]>(() => {
    if (!user || !role) return [];
    const list: Channel[] = [];
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const teamByAnyKey = (key: string) => teams.find((t) => t.id === key || t.name === key);

    // Canales de rol (Administradores / Entrenadores / Staff). El admin participa
    // en los tres; entrenadores y staff en el suyo. Se basan en el array de roles
    // (un usuario puede tener varios) y no van asociados a ningún equipo.
    const roleSet = new Set(roles);
    if (roleSet.has("admin")) {
      list.push({ id: "admins", kind: "admins", label: "Administradores", icon: ShieldCheck, canWrite: true });
      list.push({ id: "coaches", kind: "coaches", label: "Entrenadores", icon: Dumbbell, canWrite: true });
      list.push({ id: "staff", kind: "staff", label: "Staff", icon: Briefcase, canWrite: true });
    } else {
      if (roleSet.has("coach")) list.push({ id: "coaches", kind: "coaches", label: "Entrenadores", icon: Dumbbell, canWrite: true });
      if (roleSet.has("staff")) list.push({ id: "staff", kind: "staff", label: "Staff", icon: Briefcase, canWrite: true });
    }

    if (role === "admin") {
      teams.forEach((t) => {
        if (!isU12(t)) {
          list.push({ id: `team-${t.id}`, kind: "team", teamId: t.id, label: `Equipo · ${t.name}`, icon: Users, canWrite: true });
        }
        list.push({ id: `family-${t.id}`, kind: "family", teamId: t.id, label: `Familias · ${t.name}`, icon: Baby, canWrite: true });
      });
      list.push({ id: "broadcast", kind: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: true });
      families
        .filter((f) => f.head_profile_id)
        .forEach((f) => {
          list.push({
            id: `private-${f.id}`, kind: "private", familyId: f.id,
            familyLabel: f.reference_code || f.head_email || "Familia",
            label: `Privado · ${f.reference_code || f.head_email || "Familia"}`,
            icon: MessageSquareLock, canWrite: true,
          });
        });
    } else if (role === "coach") {
      coachTeamIds.forEach((tid) => {
        const t = teamByAnyKey(tid);
        const label = t?.name ?? tid;
        const teamUuid = t?.id ?? tid;
        if (!t || !isU12(t)) {
          list.push({ id: `team-${teamUuid}`, kind: "team", teamId: teamUuid, label: `Equipo · ${label}`, icon: Users, canWrite: true });
        }
        list.push({ id: `family-${teamUuid}`, kind: "family", teamId: teamUuid, label: `Familias · ${label}`, icon: Baby, canWrite: true });
      });
      list.push({ id: "broadcast", kind: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: true });
    } else if (role === "family") {
      const children = family?.children ?? [];
      // Family channels for every child's team
      const seenTeams = new Set<string>();
      children.forEach((c) => {
        if (!c.team_id) return;
        const t = teamByAnyKey(c.team_id);
        const teamUuid = t?.id ?? c.team_id;
        if (seenTeams.has(teamUuid)) return;
        seenTeams.add(teamUuid);
        const label = t?.name ?? c.team_id;
        if (isChildProfile) {
          if (currentChildId !== c.id) return;
          // Player profile: only shows team chat if NOT U12
          if (t && !isU12(t)) {
            list.push({ id: `team-${teamUuid}`, kind: "team", teamId: teamUuid, label: `Equipo · ${label}`, icon: Users, canWrite: true });
          }
        } else {
          // Adult family: family channel always. Team chat only visible for adults if team is not U12 (RLS enforces).
          list.push({ id: `family-${teamUuid}`, kind: "family", teamId: teamUuid, label: `Familias · ${label}`, icon: Baby, canWrite: true });
        }
      });
      if (!isChildProfile) {
        list.push({ id: "broadcast", kind: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: false });
      }
      // Private admin chat (adult only)
      if (isAdultFamily && family) {
        list.push({
          id: `private-${family.id}`, kind: "private", familyId: family.id,
          label: "Privado · Administración", icon: MessageSquareLock, canWrite: true,
        });
      }
    } else if (role === "player") {
      // Standalone player: team chat only if not U12 based on their linked player
      const me = players.find((p) => p.id === user.id) ?? null;
      const t = me?.team_id ? teamByAnyKey(me.team_id) : null;
      if (t && !isU12(t)) {
        list.push({ id: `team-${t.id}`, kind: "team", teamId: t.id, label: `Equipo · ${t.name}`, icon: Users, canWrite: true });
      }
    }

    // Aplica la configuración del administrador a los canales gestionables:
    // los desactivados/archivados se ocultan y los cerrados quedan en solo lectura.
    // Los canales privados (admin<->familia) no se gestionan desde aquí.
    const configured = list.flatMap<Channel>((c) => {
      if (c.kind === "private") return [c];
      const st = effectiveState(channelConfig.get(channelKey(c.kind, c.teamId)));
      if (!st.visible) return [];
      if (!st.writable) return [{ ...c, canWrite: false, readOnlyReason: "Canal cerrado por el administrador." }];
      return [c];
    });

    // De-duplicate by id
    const seen = new Set<string>();
    return configured.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  }, [user, role, roles, teams, coachTeamIds, families, players, family, isChildProfile, isAdultFamily, currentChildId, channelConfig]);

  // Auto-select first channel
  useEffect(() => {
    if (channels.length && !channels.find((c) => c.id === active)) setActive(channels[0].id);
    if (!channels.length) setActive("");
  }, [channels, active]);

  // El admin abre un chat privado concreto desde Miembros: cuando la lista de
  // canales ya incluye el privado de esa familia, seleccionarlo directamente.
  useEffect(() => {
    if (!initialPrivateFamilyId) return;
    const match = channels.find((c) => c.id === `private-${initialPrivateFamilyId}`);
    if (match) {
      setActive(match.id);
      onConsumedPrivateChat?.();
    }
  }, [initialPrivateFamilyId, channels, onConsumedPrivateChat]);

  // Listen for admin "open private chat" event
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ familyId: string }>).detail;
      if (!detail?.familyId) return;
      const target = `private-${detail.familyId}`;
      const match = channels.find((c) => c.id === target);
      if (match) setActive(match.id);
    };
    window.addEventListener("open-private-chat", onOpen);
    return () => window.removeEventListener("open-private-chat", onOpen);
  }, [channels]);


  const channel = channels.find((c) => c.id === active);

  // Load messages for active channel and subscribe realtime
  useEffect(() => {
    if (!channel || !user) return;
    let cancelled = false;

    (async () => {
      if (channel.kind === "private" && channel.familyId) {
        const { data } = await supabase
          .from("private_messages")
          .select("id, sender_id, receiver_family_id, message_text, is_read, created_at")
          .eq("receiver_family_id", channel.familyId)
          .order("created_at", { ascending: true });
        if (cancelled) return;
        setPrivateMsgs((data ?? []) as PrivateMsg[]);
        // Mark incoming as read (family reading admin msgs, or admin reading family msgs)
        const unread = (data ?? []).filter((m) => !m.is_read && m.sender_id !== user.id).map((m) => m.id);
        if (unread.length) {
          supabase.from("private_messages").update({ is_read: true }).in("id", unread)
            .then(({ error }) => { if (error) console.error("Chats: error marcando mensajes como leídos", error); });
        }
      } else {
        let q = supabase
          .from("team_messages")
          .select("id, channel_type, team_id, sender_id, sender_name, message_text, created_at")
          .eq("channel_type", channel.kind)
          .order("created_at", { ascending: true })
          .limit(200);
        if (channel.kind !== "broadcast" && channel.teamId) q = q.eq("team_id", channel.teamId);
        const { data } = await q;
        if (cancelled) return;
        setGroupMsgs((data ?? []) as GroupMsg[]);
      }
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);
    })();

    // Realtime
    const chName = channel.kind === "private" ? `private-${channel.familyId}` : `team-${channel.kind}-${channel.teamId ?? "all"}`;
    const ch = supabase
      .channel(chName)
      .on("postgres_changes",
        channel.kind === "private"
          ? { event: "INSERT", schema: "public", table: "private_messages", filter: `receiver_family_id=eq.${channel.familyId}` }
          : channel.teamId
            ? { event: "INSERT", schema: "public", table: "team_messages", filter: `team_id=eq.${channel.teamId}` }
            // Difusión: sin team_id, no filtramos por columna en el servidor. El filtro
            // por channel_type no entrega los eventos de forma fiable, así que
            // escuchamos todos los INSERT (RLS ya limita las filas visibles) y
            // filtramos por channel_type en el cliente, más abajo.
            : { event: "INSERT", schema: "public", table: "team_messages" },
        (payload) => {
          if (channel.kind === "private") {
            const msg = payload.new as PrivateMsg;
            setPrivateMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          } else {
            const msg = payload.new as GroupMsg;
            if (msg.channel_type !== channel.kind) return;
            if (channel.teamId && msg.team_id !== channel.teamId) return;
            setGroupMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
          setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);
        },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [channel, user]);

  const send = useCallback(async () => {
    if (!user || !channel || !text.trim()) return;
    const body = text.trim();
    setText("");
    const scrollToEnd = () => setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 30);
    // Añadimos el mensaje al estado a partir de la fila devuelta por la BD (no de un
    // id temporal): así aparece de inmediato en todos los canales —incluido el de
    // difusión, donde el eco de realtime no llega de forma fiable— y la
    // deduplicación por id evita duplicados cuando además sí llegue el evento.
    if (channel.kind === "private" && channel.familyId) {
      const { data, error } = await supabase
        .from("private_messages")
        .insert({ sender_id: user.id, receiver_family_id: channel.familyId, message_text: body })
        .select("id, sender_id, receiver_family_id, message_text, is_read, created_at")
        .single();
      if (error) { console.error("Chats: error enviando mensaje privado", error); setText(body); return; }
      if (data) {
        const msg = data as PrivateMsg;
        setPrivateMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        scrollToEnd();
      }
    } else {
      const { data, error } = await supabase
        .from("team_messages")
        .insert({
          channel_type: channel.kind, team_id: channel.teamId ?? null,
          sender_id: user.id, sender_name: fullName || user.email || "Usuario", message_text: body,
        })
        .select("id, channel_type, team_id, sender_id, sender_name, message_text, created_at")
        .single();
      if (error) { console.error("Chats: error enviando mensaje", error); setText(body); return; }
      if (data) {
        const msg = data as GroupMsg;
        setGroupMsgs((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        scrollToEnd();
      }
    }
  }, [user, channel, text, fullName]);

  if (!channels.length) {
    return (
      <Card>
        <CardContent className="space-y-2 py-10 text-center text-sm text-muted-foreground">
          <ShieldAlert className="mx-auto h-6 w-6 text-warning" />
          <div className="font-semibold text-foreground">No hay chats disponibles</div>
          <p>
            {isChildProfile
              ? "Tu equipo es categoría U12: la comunicación se gestiona desde el chat de familias con los adultos responsables."
              : "Aún no tienes canales asignados."}
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentMsgs = channel?.kind === "private"
    ? privateMsgs.map((m) => ({ id: m.id, mine: m.sender_id === user!.id, name: m.sender_id === user!.id ? "Yo" : (role === "admin" ? "Familia" : "Administración"), text: m.message_text }))
    : groupMsgs.map((m) => ({ id: m.id, mine: m.sender_id === user!.id, name: m.sender_name, text: m.message_text }));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 sm:grid-cols-[240px_1fr]">
          <div className="max-h-[420px] overflow-y-auto border-b border-border sm:border-b-0 sm:border-r">
            {channels.map((c) => {
              const I = c.icon;
              const isActive = c.id === active;
              return (
                <button key={c.id} onClick={() => setActive(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${isActive ? "bg-primary/15 text-primary" : "hover:bg-surface"}`}>
                  <I className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.label}</span>
                  {c.kind === "private" && <Lock className="ml-auto h-3 w-3 opacity-70" />}
                </button>
              );
            })}
          </div>
          <div className="flex h-[420px] flex-col">
            {channel?.kind === "private" && (
              <div className="flex items-center gap-2 border-b border-border bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Conversación privada · solo visible en el perfil de Adultos Responsables.
              </div>
            )}
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
              {currentMsgs.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Sin mensajes todavía.</div>}
              {currentMsgs.map((m) => (
                <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
                    {!m.mine && <div className="mb-0.5 text-[10px] font-semibold opacity-70">{m.name}</div>}
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-2">
              {channel?.canWrite ? (
                <div className="flex gap-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe un mensaje..." />
                  <Button onClick={send}><Send className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">{channel?.readOnlyReason ?? "Canal solo lectura · únicamente entrenador/admin escriben."}</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
