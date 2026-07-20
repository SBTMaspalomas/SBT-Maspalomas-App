import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, MapPin, CheckCircle, AlertCircle, Clock } from "lucide-react";

interface Convocatoria {
  id: string;
  team_id: string;
  type: "training" | "match";
  date: string;
  time: string;
  location: string;
  notes: string | null;
  team_name?: string;
}

interface PlayerResponse {
  id: string;
  convocatoria_id: string;
  status: "confirmed" | "problem" | "pending";
  problem_type?: string;
  notes?: string;
}

export function ConvocatoriesPlayer({ playerId: playerIdProp }: { playerId?: string } = {}) {
  const { activeProfile } = useAuth();
  // Identidad del jugador. Prioriza el prop (p. ej. jugador SENIOR: su ficha propia vía
  // auth.selfPlayerId). Si no, se usa el perfil de hijo de una cuenta de familia
  // (activeProfile.childId apunta a players.id). Sin ninguno, no se permite responder.
  const playerId = playerIdProp ?? (activeProfile?.kind === "child" ? activeProfile.childId : null);

  const [convocatorias, setConvocatorias] = useState<Convocatoria[]>([]);
  const [responses, setResponses] = useState<Map<string, PlayerResponse>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [problemType, setProblemType] = useState<string>("");
  const [problemNotes, setProblemNotes] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);

    // Get convocatorias for player's team
    const { data: convData, error: convErr } = await supabase
      .from("convocatorias")
      .select("*")
      .order("date", { ascending: false });
    if (convErr) console.error("ConvocatoriesPlayer: error cargando convocatorias", convErr);

    // Get ONLY this player's responses
    let respData: any[] = [];
    if (playerId) {
      const { data, error: respErr } = await supabase
        .from("convocatoria_responses")
        .select("*")
        .eq("player_id", playerId);
      if (respErr) console.error("ConvocatoriesPlayer: error cargando respuestas", respErr);
      respData = data || [];
    }

    setConvocatorias((convData || []) as Convocatoria[]);

    const respMap = new Map<string, PlayerResponse>();
    respData.forEach((r: any) => {
      respMap.set(r.convocatoria_id, r);
    });
    setResponses(respMap);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRespond = async (convId: string, status: "confirmed" | "problem") => {
    if (!playerId) {
      toast.error("No se pudo identificar al jugador");
      return;
    }
    const { error } = await supabase.from("convocatoria_responses").insert({
      convocatoria_id: convId,
      player_id: playerId,
      status,
      problem_type: status === "problem" ? problemType : null,
      notes: problemNotes || null,
    });

    if (error) {
      toast.error("Error al responder");
      return;
    }

    toast.success(`Respuesta registrada: ${status === "confirmed" ? "Confirmado" : "Problema"}`);
    setSelectedConvId(null);
    setProblemType("");
    setProblemNotes("");
    loadData();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "problem":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed":
        return "Confirmado";
      case "problem":
        return "Problema";
      default:
        return "Pendiente";
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold">Mis Convocatorias</h2>
        <p className="text-sm text-muted-foreground">Entrenamientos y partidos convocados</p>
      </div>

      {/* Convocatorias List */}
      <div className="space-y-2">
        {loading ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">Cargando...</p>
          </Card>
        ) : convocatorias.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay convocatorias para ti</p>
          </Card>
        ) : (
          convocatorias.map((conv) => {
            const response = responses.get(conv.id);
            const date = new Date(conv.date);
            const dateStr = date.toLocaleDateString("es-ES", { weekday: "short", month: "short", day: "numeric" });

            return (
              <Card key={conv.id} className={`p-4 ${response ? "border-primary/30 bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={conv.type === "match" ? "default" : "secondary"}>
                        {conv.type === "match" ? "Partido" : "Entrenamiento"}
                      </Badge>
                      {response && (
                        <div className="flex items-center gap-1">
                          {getStatusIcon(response.status)}
                          <span className="text-xs font-medium">{getStatusLabel(response.status)}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {dateStr} a las {conv.time}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        {conv.location}
                      </div>
                      {conv.notes && (
                        <p className="text-xs text-muted-foreground italic">{conv.notes}</p>
                      )}
                    </div>

                    {response?.problem_type && (
                      <div className="mt-2 rounded bg-yellow-50 p-2 text-xs">
                        <p className="font-medium text-yellow-900">{response.problem_type}</p>
                        {response.notes && <p className="text-yellow-800">{response.notes}</p>}
                      </div>
                    )}
                  </div>

                  {!response ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          Responder
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Responder a Convocatoria</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="text-sm">
                            <p className="font-medium mb-1">{conv.type === "match" ? "Partido" : "Entrenamiento"}</p>
                            <p className="text-muted-foreground">{dateStr} a las {conv.time}</p>
                            <p className="text-muted-foreground">{conv.location}</p>
                          </div>

                          <div className="space-y-2">
                            <Button
                              onClick={() => handleRespond(conv.id, "confirmed")}
                              className="w-full bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Confirmo Asistencia
                            </Button>

                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                  <AlertCircle className="h-4 w-4 mr-2" />
                                  Tengo un Problema
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Reportar Problema</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-sm font-medium">Tipo de Problema</label>
                                    <select
                                      value={problemType}
                                      onChange={(e) => setProblemType(e.target.value)}
                                      className="w-full rounded border border-border bg-background p-2 text-sm"
                                    >
                                      <option value="">Selecciona...</option>
                                      <option value="late">Llegaré tarde</option>
                                      <option value="absence">No puedo asistir</option>
                                      <option value="injury">Lesión</option>
                                      <option value="other">Otro</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-sm font-medium">Notas adicionales</label>
                                    <textarea
                                      value={problemNotes}
                                      onChange={(e) => setProblemNotes(e.target.value)}
                                      placeholder="Explica brevemente..."
                                      className="w-full rounded border border-border bg-background p-2 text-sm"
                                      rows={3}
                                    />
                                  </div>

                                  <Button
                                    onClick={() => handleRespond(conv.id, "problem")}
                                    className="w-full"
                                  >
                                    Enviar Reporte
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {getStatusLabel(response.status)}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
