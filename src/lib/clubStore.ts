import { useSyncExternalStore } from "react";

export type Role = "admin" | "coach" | "parent" | "player" | "family";
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
  photo?: string;
  dniFront?: string;
  dniBack?: string;
  tutorDniFront?: string;
  tutorDniBack?: string;
  federativaPdf?: string;
  signature?: string;
  auth_image: boolean;
  auth_travel: boolean;
  auth_medical: boolean;
  docStatus: DocStatus;
  rejectReason?: string;
  payments: { period: string; paid: boolean; receipt?: string }[];
  attendance: Record<string, { training: boolean; match: boolean; status?: "present" | "late" | "absent"; absentReason?: "justified" | "unjustified" }>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamIds?: string[];
  playerId?: string;
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
  date: string;
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

const emptyState = (): ClubState => ({
  currentUserId: "",
  users: [],
  teams: [],
  players: [],
  matches: [],
  announcements: [],
  permDocs: [],
  chats: [],
  clubIban: "ES00 0000 0000 0000 0000 0000",
  clubBizum: "+34 000 000 000",
});

let state: ClubState = emptyState();
const listeners = new Set<() => void>();

// Notifica a los suscriptores del store. (No se persiste en localStorage: el estado se
// rehidrata siempre desde Supabase vía useClubData, y nada releía "club_state_v1".)
const persist = () => {
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
    state = emptyState();
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

export const currentUser = (s: ClubState) => s.users.find((u) => u.id === s.currentUserId);
