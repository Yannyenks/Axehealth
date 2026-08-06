import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { LockedError } from "@/lib/api-error";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Anti brute-force minimal: après MAX_ATTEMPTS mots de passe erronés
// consécutifs, le compte est verrouillé pour LOCKOUT_MINUTES — même avec le
// bon mot de passe entré ensuite, il faut attendre l'expiration. Le
// compteur est remis à zéro à chaque connexion réussie.
export function assertNotLocked(user: Pick<User, "lockedUntil">): void {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    throw new LockedError(`Compte temporairement verrouillé après trop de tentatives. Réessayez dans ${minutesLeft} min.`);
  }
}

export async function recordFailedLogin(userId: string, currentAttempts: number): Promise<void> {
  const attempts = currentAttempts + 1;

  if (attempts >= MAX_ATTEMPTS) {
    await prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) },
    });
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: attempts } });
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { failedLoginAttempts: 0, lockedUntil: null } });
}
