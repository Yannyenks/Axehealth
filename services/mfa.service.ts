import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { generateBase32Secret, verifyTotp, buildOtpAuthUri, generateBackupCodes } from "@/lib/totp";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { ForbiddenError } from "@/lib/rbac";

// Étape 1/2 de l'activation: génère un secret et le stocke, mais
// n'active rien tant que l'utilisateur n'a pas prouvé qu'il peut produire
// un code valide avec son application d'authentification (voir confirmMfaSetup).
export async function startMfaSetup(userId: string, accountEmail: string) {
  const secret = generateBase32Secret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret, totpEnabled: false } });

  return { secret, otpAuthUri: buildOtpAuthUri(secret, accountEmail) };
}

export async function confirmMfaSetup(userId: string, code: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpSecret) throw new ConflictError("Aucune activation MFA en cours — relancez la configuration");
  if (!verifyTotp(user.totpSecret, code)) throw new ForbiddenError("Code invalide");

  const backupCodes = generateBackupCodes();
  const hashedCodes = await Promise.all(backupCodes.map((code) => hashPassword(code)));

  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true, totpBackupCodes: hashedCodes } });

  return { backupCodes }; // affichés une seule fois — jamais récupérables ensuite
}

// Désactivation: exige soit un code TOTP valide, soit le mot de passe du
// compte — jamais un simple bouton, pour qu'un poste laissé déverrouillé ne
// suffise pas à retirer le second facteur.
export async function disableMfa(userId: string, params: { totpCode?: string; password?: string }) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.totpEnabled || !user.totpSecret) throw new ConflictError("Le MFA n'est pas activé sur ce compte");

  const validTotp = params.totpCode ? verifyTotp(user.totpSecret, params.totpCode) : false;
  const validPassword = params.password ? await verifyPassword(user.passwordHash, params.password) : false;
  if (!validTotp && !validPassword) throw new ForbiddenError("Code MFA ou mot de passe invalide");

  await prisma.user.update({ where: { id: userId }, data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] } });
}

// Consomme un code de secours (usage unique) — retiré de la liste dès
// validation pour empêcher toute réutilisation.
async function tryConsumeBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  for (const hashed of user.totpBackupCodes) {
    if (await verifyPassword(hashed, code)) {
      await prisma.user.update({
        where: { id: userId },
        data: { totpBackupCodes: user.totpBackupCodes.filter((h) => h !== hashed) },
      });
      return true;
    }
  }
  return false;
}

export async function verifyMfaLogin(userId: string, code: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");
  if (!user.totpEnabled || !user.totpSecret) throw new ConflictError("Le MFA n'est pas activé sur ce compte");

  if (verifyTotp(user.totpSecret, code)) return user;
  if (await tryConsumeBackupCode(userId, code)) return user;

  throw new ForbiddenError("Code invalide");
}
