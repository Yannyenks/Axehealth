import type { Patient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LockedError } from "@/lib/api-error";

// Dupliqué (pas généralisé) depuis services/login-security.service.ts — les
// deux domaines d'authentification (staff vs patient) ne doivent jamais
// partager de code, et chaque fonction ne fait qu'une dizaine de lignes.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export function assertNotLocked(patient: Pick<Patient, "lockedUntil">): void {
  if (patient.lockedUntil && patient.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((patient.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new LockedError(`Compte temporairement verrouillé après trop de tentatives. Réessayez dans ${minutesLeft} min.`);
  }
}

export async function recordFailedLogin(patientId: string, currentAttempts: number): Promise<void> {
  const attempts = currentAttempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.patient.update({
      where: { id: patientId },
      data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) },
    });
    return;
  }

  await prisma.patient.update({ where: { id: patientId }, data: { failedLoginAttempts: attempts } });
}

export async function recordSuccessfulLogin(patientId: string): Promise<void> {
  await prisma.patient.update({ where: { id: patientId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
}
