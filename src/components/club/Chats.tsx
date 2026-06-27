import { useMemo, useState } from "react";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, Megaphone, Users, Baby } from "lucide-react";

interface Channel { id: string; label: string; icon: typeof Users; canWrite: boolean; }

function channelsForUser(s: ReturnType<typeof clubStore.get>) {
  const u = s.users.find((x) => x.id === s.currentUserId)!;
  const list: Channel[] = [];
  if (u.role === "admin") {
    s.teams.forEach((t) => {
      list.push({ id: `team-${t.id}`, label: `Equipo · ${t.name}`, icon: Users, canWrite: true });
      list.push({ id: `parents-${t.id}`, label: `Padres · ${t.name}`, icon: Baby, canWrite: true });
    });
    list.push({ id: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: true });
  } else if (u.role === "coach") {
    u.teamIds?.forEach((tid) => {
      const t = s.teams.find((x) => x.id === tid)!;
      list.push({ id: `team-${tid}`, label: `Equipo · ${t.name}`, icon: Users, canWrite: true });
      list.push({ id: `parents-${tid}`, label: `Padres · ${t.name}`, icon: Baby, canWrite: true });
    });
    list.push({ id: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: true });
  } else if (u.role === "parent") {
    const player = s.players.find((p) => p.id === u.playerId);
    if (player) {
      const t = s.teams.find((x) => x.id === player.teamId)!;
      list.push({ id: `team-${t.id}`, label: `Equipo · ${t.name}`, icon: Users, canWrite: true });
      list.push({ id: `parents-${t.id}`, label: `Padres · ${t.name}`, icon: Baby, canWrite: true });
    }
    list.push({ id: "broadcast", label: "Canal de Difusión", icon: Megaphone, canWrite: false });
  }
  return list;
}

export function Chats() {
  const user = useClub(currentUser);
  const channels = useClub(channelsForUser);
  const messages = useClub((s) => s.chats);
  const [active, setActive] = useState(channels[0]?.id ?? "broadcast");
  const [text, setText] = useState("");
  const channel = channels.find((c) => c.id === active) ?? channels[0];
  const msgs = useMemo(() => messages.filter((m) => m.channelId === channel?.id), [messages, channel]);

  const send = () => {
    if (!text.trim() || !channel) return;
    clubStore.set((s) => {
      s.chats.push({ id: `c-${Date.now()}`, channelId: channel.id, userId: user.id, userName: user.name, text: text.trim(), at: Date.now() });
    });
    setText("");
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr]">
          <div className="border-b border-border sm:border-b-0 sm:border-r">
            {channels.map((c) => {
              const I = c.icon;
              const isActive = c.id === active;
              return (
                <button key={c.id} onClick={() => setActive(c.id)}
                  className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors ${isActive ? "bg-primary/15 text-primary" : "hover:bg-surface"}`}>
                  <I className="h-4 w-4 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex h-[420px] flex-col">
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {msgs.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">Sin mensajes todavía.</div>}
              {msgs.map((m) => {
                const mine = m.userId === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-surface"}`}>
                      {!mine && <div className="mb-0.5 text-[10px] font-semibold opacity-70">{m.userName}</div>}
                      {m.text}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-2">
              {channel?.canWrite ? (
                <div className="flex gap-2">
                  <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Escribe un mensaje..." />
                  <Button onClick={send}><Send className="h-4 w-4" /></Button>
                </div>
              ) : (
                <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">Canal solo lectura · únicamente entrenador/admin escriben.</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
