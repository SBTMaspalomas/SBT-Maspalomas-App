import { useState } from "react";
import { clubStore, useClub, currentUser } from "@/lib/clubStore";
import { useMatches } from "@/hooks/use-matches";
import { localVisitante, mapsUrl } from "@/lib/matches";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Download, Plus, FileText, Clock } from "lucide-react";
import { toast } from "sonner";

export function Board() {
  const { matches: sortedMatches } = useMatches();
  const teams = useClub((s) => s.teams);
  const permDocs = useClub((s) => s.permDocs);
  const announcements = useClub((s) => s.announcements);
  const user = useClub(currentUser);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");

  const post = () => {
    if (!newTitle.trim()) return;
    clubStore.set((s) => {
      s.announcements.unshift({ id: `a-${Date.now()}`, title: newTitle, body: newBody, at: Date.now() });
    });
    setNewTitle(""); setNewBody("");
    toast.success("Anuncio publicado");
  };

  return (
    <Card>
      <CardHeader><CardTitle>Cartelera del Club</CardTitle></CardHeader>
      <CardContent>
        <Tabs defaultValue="jornada">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="jornada">La Jornada</TabsTrigger>
            <TabsTrigger value="info">Información</TabsTrigger>
            <TabsTrigger value="tablon">Tablón</TabsTrigger>
          </TabsList>

          <TabsContent value="jornada" className="mt-4 space-y-2">
            {sortedMatches.map((m) => {
              const team = teams.find((t) => t.id === m.team_id);
              const { local, visitante } = localVisitante(m, team?.name ?? "Nuestro equipo");
              return (
                <div key={m.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-wide text-primary">{team?.name}</div>
                      <div className="truncate font-semibold">{local} <span className="text-muted-foreground">vs</span> {visitante}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {new Date(m.match_date).toLocaleDateString("es-ES", { weekday: "long", day: "2-digit", month: "short" })}{m.match_time ? ` · ${m.match_time}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.is_home ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                        {m.is_home ? "CASA" : "FUERA"}
                      </span>
                    </div>
                  </div>
                  {m.venue_address && (
                    <a className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      href={mapsUrl(m.venue_address)}
                      target="_blank" rel="noreferrer">
                      <MapPin className="h-3 w-3" /> {m.venue ?? m.venue_address} · abrir en Maps
                    </a>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="info" className="mt-4 space-y-2">
            {permDocs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{d.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{d.filename}</div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => toast.info(`Descargando ${d.filename} (simulado)`)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" /> PDF
                </Button>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="tablon" className="mt-4 space-y-3">
            {(user?.role === "admin" || user?.role === "coach") && (
              <div className="space-y-2 rounded-lg border border-border bg-surface p-3">
                <div className="text-sm font-semibold">Publicar anuncio</div>
                <Input placeholder="Título (ej: Entrenamiento suspendido)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                <Textarea placeholder="Cuerpo del mensaje..." value={newBody} onChange={(e) => setNewBody(e.target.value)} />
                <Button size="sm" onClick={post}><Plus className="mr-1.5 h-3.5 w-3.5" /> Publicar</Button>
              </div>
            )}
            {announcements.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="font-semibold">{a.title}</div>
                <div className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString("es-ES")}</div>
                {a.body && <div className="mt-1.5 text-sm">{a.body}</div>}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
