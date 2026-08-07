import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError, NotFoundError } from "@/lib/api-error";
import { ForbiddenError } from "@/lib/rbac";
import type { CreateTeamMemberInput, UpdateTeamMemberInput } from "@/lib/validations/team";

const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

// Jamais passwordHash, pinHash, totpSecret, totpBackupCodes ou refreshToken
// au-delà du service — ce sont des secrets, pas des champs d'affichage, et
// cette liste est le seul rempart entre un `prisma.user.xxx()` et une
// réponse API qui les exposerait par accident.
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  departmentId: true,
  isActive: true,
  lastLoginAt: true,
  totpEnabled: true,
} as const;

function generateTempPassword(): string {
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return password;
}

export async function listTeamMembers(organizationId: string) {
  // Un compte support (assistance super-admin) n'est jamais visible du
  // client — voir prisma/schema.prisma sur User.isSupportAccount.
  return prisma.user.findMany({
    where: { organizationId, isSupportAccount: false },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      totpEnabled: true,
      department: { select: { id: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }],
  });
}

// Pas d'envoi d'email (aucun fournisseur SMTP branché) — le mot de passe
// provisoire est retourné une seule fois à l'appelant (l'admin), qui le
// communique lui-même à la nouvelle recrue. Jamais stocké en clair ni renvoyé
// à nouveau ensuite.
export async function createTeamMember(organizationId: string, input: CreateTeamMemberInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new ConflictError("Un compte existe déjà avec cet email");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const user = await prisma.user.create({
    data: {
      organizationId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      phone: input.phone,
      departmentId: input.departmentId,
      passwordHash,
    },
    select: SAFE_USER_SELECT,
  });

  return { user, tempPassword };
}

// Un admin ne peut pas se désactiver lui-même, ni désactiver le dernier
// administrateur actif de l'organisation — sinon l'organisation se
// retrouverait sans personne habilitée à revenir en arrière.
export async function updateTeamMember(organizationId: string, userId: string, actingUserId: string, input: UpdateTeamMemberInput) {
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId, isSupportAccount: false } });
  if (!user) throw new NotFoundError("Utilisateur introuvable");

  const willDeactivate = input.isActive === false;
  const willDemote = input.role !== undefined && input.role !== "ADMIN" && user.role === "ADMIN";

  if ((willDeactivate || willDemote) && userId === actingUserId) {
    throw new ForbiddenError("Vous ne pouvez pas modifier votre propre statut administrateur");
  }

  if (willDeactivate || willDemote) {
    // Un compte support ne doit jamais compter comme un administrateur de
    // secours pour cette garde-fou — sinon on pourrait démettre le dernier
    // vrai administrateur tant qu'une session d'assistance existe.
    const otherActiveAdmins = await prisma.user.count({
      where: { organizationId, role: "ADMIN", isActive: true, isSupportAccount: false, id: { not: userId } },
    });
    if (otherActiveAdmins === 0) {
      throw new ConflictError("Impossible: il doit rester au moins un administrateur actif dans l'organisation");
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role: input.role, isActive: input.isActive, departmentId: input.departmentId },
    select: SAFE_USER_SELECT,
  });
}
