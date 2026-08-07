import { create } from "zustand";
import type { OrgPlan, Role } from "@prisma/client";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  organizationId: string;
  organization?: {
    name: string;
    slug: string;
    logoUrl: string | null;
    primaryColor: string | null;
    plan: OrgPlan;
    trialEndsAt: string | null;
    onboardingCompletedAt: string | null;
  };
  totpEnabled?: boolean;
  isSuperAdmin?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  // Vrai lorsque la session en cours est une session d'assistance
  // super-admin (voir app/api/superadmin/organisations/[id]/assistance) —
  // dérivé du token, pas de l'utilisateur, donc distinct de `user`.
  impersonationActive: boolean;
  setUser: (user: AuthUser, impersonationActive?: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  impersonationActive: false,
  setUser: (user, impersonationActive = false) => set({ user, status: "authenticated", impersonationActive }),
  clear: () => set({ user: null, status: "unauthenticated", impersonationActive: false }),
}));
