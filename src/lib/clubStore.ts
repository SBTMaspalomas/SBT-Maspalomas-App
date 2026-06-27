import { useSyncExternalStore } from "react";

export type Role = "admin" | "coach" | "parent";

export type DocStatus = "pending" | "approved" | "rejected";

export interface Team {
  id: string;
  name: string;
  category: string;
  coachId: string;
}

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  docType: "DNI" | "NIE" | "PASAPORTE";
  docNumber: string;
  teamId: string;
  parentId: string;
  // documents
  photo?: string;
  dniFront?: string;
  dniBack?: string;
  tutorDniFront?: string;
  tutorDniBack?: string;
  federativaPdf?: string; // filename
  signature?: string; // dataURL
  auth_image: boolean;
  auth_travel: boolean;
  auth_medical: boolean;
  docStatus: DocStatus;
  rejectReason?: string;
  payments: { period: "Septiembre" | "Noviembre" | "Febrero"; paid: boolean; receipt?: string }[];
  attendance: Record<string, { training: boolean; match: boolean }>; // date -> marks
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds?: string[]; // for coach
  playerId?: string; // for parent
}

export interface ChatMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  text: string;
  at: number;
}

export interface Match {
  id: string;
  teamId: string;
  date: string; // ISO
  time: string;
  opponent: string;
  venue: "home" | "away";
  address?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  at: number;
}

export interface PermDoc {
  id: string;
  title: string;
  filename: string;
}

export interface ClubState {
  currentUserId: string;
  users: User[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  announcements: Announcement[];
  permDocs: PermDoc[];
  chats: ChatMessage[];
  clubIban: string;
  clubBizum: string;
}

const KEY = "club_state_v1";

const seed = (): ClubState => {
  const users: User[] = [
    { id: "u-admin", name: "Carlos (Admin)", email: "admin@club.es", role: "admin" },
    { id: "u-coach1", name: "Marta López", email: "marta@club.es", role: "coach", teamIds: ["t1"] },
    { id: "u-coach2", name: "Jorge Ruiz", email: "jorge@club.es", role: "coach", teamIds: ["t2"] },
    { id: "u-parent1", name: "Ana García", email: "ana@mail.es", role: "parent", playerId: "p1" },
    { id: "u-parent2", name: "Luis Pérez", email: "luis@mail.es", role: "parent", playerId: "p6" },
  ];
  const teams: Team[] = [
    { id: "t1", name: "Mini A", category: "Mini (10-11 años)", coachId: "u-coach1" },
    { id: "t2", name: "Infantil B", category: "Infantil (12-13 años)", coachId: "u-coach2" },
  ];
  const periods = ["Septiembre", "Noviembre", "Febrero"] as const;
  const mkPlayer = (i: number, teamId: string, parentId: string, status: DocStatus, paidMask: boolean[]): Player => ({
    id: `p${i}`,
    firstName: ["Lucía","Mateo","Sofía","Hugo","Valeria","Diego","Carla","Pablo","Noa","Iván"][i-1] ?? `Jug${i}`,
    lastName: ["Martín","Sánchez","Romero","Vega","Ortiz","Castro","Bravo","Soto","Lago","Mora"][i-1] ?? "Apellido",
    birthDate: `201${i%9}-0${(i%9)+1}-15`,
    docType: "DNI",
    docNumber: `1234567${i}A`,
    teamId,
    parentId,
    auth_image: true,
    auth_travel: true,
    auth_medical: true,
    docStatus: status,
    payments: periods.map((p, idx) => ({ period: p, paid: paidMask[idx] })),
    attendance: {},
  });
  const players: Player[] = [
    mkPlayer(1, "t1", "u-parent1", "approved",  [true, true, false]),
    mkPlayer(2, "t1", "u-parent1", "approved",  [true, false, false]),
    mkPlayer(3, "t1", "u-parent1", "pending",   [false, false, false]),
    mkPlayer(4, "t1", "u-parent1", "approved",  [true, true, true]),
    mkPlayer(5, "t1", "u-parent1", "rejected",  [false, false, false]),
    mkPlayer(6, "t2", "u-parent2", "approved",  [true, true, true]),
    mkPlayer(7, "t2", "u-parent2", "pending",   [true, false, false]),
    mkPlayer(8, "t2", "u-parent2", "approved",  [true, true, false]),
    mkPlayer(9, "t2", "u-parent2", "approved",  [false, false, false]),
    mkPlayer(10,"t2", "u-parent2", "approved",  [true, true, true]),
  ];
  players[4].rejectReason = "DNI ilegible, vuelve a subirlo.";
  // pre-seed some attendance
  const today = new Date();
  for (let d = 0; d < 8; d++) {
    const date = new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
    players.forEach((p, idx) => {
      p.attendance[date] = { training: (idx + d) % 3 !== 0, match: (idx + d) % 4 === 0 };
    });
  }
  const matches: Match[] = [
    { id: "m1", teamId: "t1", date: new Date(Date.now() + 2*86400000).toISOString().slice(0,10), time: "10:00", opponent: "CB Rivas", venue: "home" },
    { id: "m2", teamId: "t1", date: new Date(Date.now() + 3*86400000).toISOString().slice(0,10), time: "12:30", opponent: "Estudiantes B", venue: "away", address: "Polideportivo Sur, Madrid" },
    { id: "m3", teamId: "t2", date: new Date(Date.now() + 2*86400000).toISOString().slice(0,10), time: "17:00", opponent: "Pozuelo CB", venue: "away", address: "Av. de Europa 12, Pozuelo" },
    { id: "m4", teamId: "t2", date: new Date(Date.now() + 3*86400000).toISOString().slice(0,10), time: "19:00", opponent: "Alcobendas", venue: "home" },
  ];
  return {
    currentUserId: "u-admin",
    users,
    teams,
    players,
    matches,
    announcements: [
      { id: "a1", title: "Entrenamiento del martes suspendido", body: "Por aviso de lluvia, cancelamos la sesión.", at: Date.now() - 3600_000 },
      { id: "a2", title: "Torneo de Reyes", body: "Inscripciones abiertas hasta el 20.", at: Date.now() - 86400_000 },
    ],
    permDocs: [
      { id: "d1", title: "Calendario de temporada", filename: "calendario_2025_2026.pdf" },
      { id: "d2", title: "Normativa interna del club", filename: "normativa.pdf" },
      { id: "d3", title: "Vacaciones y torneos", filename: "vacaciones_torneos.pdf" },
      { id: "d4", title: "Ficha Federativa (oficial)", filename: "ficha_federativa.pdf" },
    ],
    chats: [
      { id: "c1", channelId: "team-t1", userId: "u-coach1", userName: "Marta López", text: "Mañana entrenamos a las 18h. ¡Puntuales!", at: Date.now() - 7200_000 },
      { id: "c2", channelId: "parents-t1", userId: "u-coach1", userName: "Marta López", text: "¿Quién puede llevar coche el sábado?", at: Date.now() - 5400_000 },
      { id: "c3", channelId: "broadcast", userId: "u-admin", userName: "Carlos (Admin)", text: "Recordad pagar la cuota de noviembre.", at: Date.now() - 3600_000 },
    ],
    clubIban: "ES12 3456 7890 1234 5678 9012",
    clubBizum: "+34 600 123 456",
  };
};

const load = (): ClubState => {
  if (typeof window === "undefined") return seed();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      const s = seed();
      localStorage.setItem(KEY, JSON.stringify(s));
      return s;
    }
    return JSON.parse(raw) as ClubState;
  } catch {
    return seed();
  }
};

let state: ClubState = typeof window !== "undefined" ? load() : seed();
const listeners = new Set<() => void>();

const persist = () => {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
};

export const clubStore = {
  get: () => state,
  set: (updater: (s: ClubState) => ClubState | void) => {
    const next = updater(state);
    state = next ?? state;
    persist();
  },
  reset: () => {
    state = seed();
    persist();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useClub<T>(selector: (s: ClubState) => T): T {
  return useSyncExternalStore(
    (cb) => {
      const unsub = clubStore.subscribe(cb);
      return () => { unsub(); };
    },
    () => selector(clubStore.get()),
    () => selector(state),
  );
}

export const currentUser = (s: ClubState) => s.users.find((u) => u.id === s.currentUserId)!;
