import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import type { SignupInput } from "@/lib/validations/auth";
import type { UpdateOrganizationInput } from "@/lib/validations/organization";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "clinique";
  let slug = root;
  let attempt = 0;

  while (await prisma.organization.findUnique({ where: { slug } })) {
    attempt += 1;
    slug = `${root}-${attempt}`;
  }

  return slug;
}

const TRIAL_DURATION_DAYS = 30;

// Inscription self-service: crée l'organisation (le tenant) et son premier
// utilisateur, avec le rôle ADMIN — c'est ce compte qui invitera/créera
// ensuite le reste de l'équipe (médecins, caissiers, etc.) depuis l'app, et
// qui sera redirigé vers /onboarding tant que le profil n'est pas complété.
export async function signupOrganization(input: SignupInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new ConflictError("Un compte existe déjà avec cet email");

  const slug = await uniqueSlug(input.organizationName);
  const passwordHash = await hashPassword(input.password);
  const trialEndsAt = new Date(Date.now() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug, city: input.city, country: input.country, plan: input.plan, trialEndsAt },
    });

    const user = await tx.user.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "ADMIN",
      },
    });

    return { organization, user };
  });
}

// Le slug (identifiant technique déjà utilisé dans les URLs/exports) n'est
// jamais recalculé ici, même si le nom affiché change — un slug qui bouge
// casserait tout lien déjà partagé.
export async function updateOrganizationProfile(organizationId: string, input: UpdateOrganizationInput) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: input,
  });
}

// Marque la fin de l'assistant d'onboarding (/onboarding) — idempotent, pour
// que le bouton final puisse être rappelé sans effet de bord si l'ADMIN
// double-clique ou revient en arrière dans le navigateur.
export async function completeOnboarding(organizationId: string) {
  return prisma.organization.update({
    where: { id: organizationId },
    data: { onboardingCompletedAt: new Date() },
  });
}
