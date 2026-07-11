import { useClub } from "@/lib/clubStore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Search, FileCheck, Clock, X } from "lucide-react";

export function PlayersList() {
  const players = useClub((s) => s.players);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredPlayers = players.filter((p) =>
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: players.length,
    approved: players.filter((p) => p.docStatus === "approved").length,
    pending: players.filter((p) => p.docStatus === "pending").length,
    rejected: players.filter((p) => p.docStatus === "rejected").length,
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success/10 text-success border-success/30";
      case "pending":
        return "bg-warning/10 text-warning border-warning/30";
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive/30";
      default:
        return "bg-muted/10 text-muted-foreground border-muted/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <FileCheck className="h-4 w-4" />;
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "rejected":
        return <X className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Aprobados" value={stats.approved} tone="success" />
        <StatCard label="Pendientes" value={stats.pending} tone="warning" />
        <StatCard label="Rechazados" value={stats.rejected} tone="destructive" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Players List */}
      <div className="space-y-2">
        {filteredPlayers.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "No se encontraron jugadores" : "No hay jugadores registrados aún"}
            </p>
          </Card>
        ) : (
          filteredPlayers.map((player) => (
            <Card key={player.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-foreground">{player.full_name}</div>
                  <div className="text-sm text-muted-foreground">{player.email}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs">
                      {player.birth_date ? new Date(player.birth_date).getFullYear() : "—"}
                    </Badge>
                    {player.phone && (
                      <Badge variant="outline" className="text-xs">
                        {player.phone}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge className={`flex items-center gap-1 ${getStatusColor(player.docStatus)}`}>
                    {getStatusIcon(player.docStatus)}
                    <span className="capitalize">
                      {player.docStatus === "approved" && "Aprobado"}
                      {player.docStatus === "pending" && "Pendiente"}
                      {player.docStatus === "rejected" && "Rechazado"}
                    </span>
                  </Badge>
                  <Button variant="outline" size="sm">
                    Ver detalles
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "warning" | "destructive" }) {
  const toneCls =
    tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card className="p-3">
      <div className={`text-2xl font-black ${toneCls}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </Card>
  );
}
