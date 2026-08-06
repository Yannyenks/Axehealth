import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ConflictError } from "@/lib/api-error";
import type { SignupInput } from "@/lib/validations/auth";

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

// Inscription self-service: crée l'organisation (le tenant) et son premier
// utilisateur, avec le rôle ADMIN — c'est ce compte qui invitera/créera
// ensuite le reste de l'équipe (médecins, caissiers, etc.) depuis l'app.
export async function signupOrganization(input: SignupInput) {
  const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
  if (existingUser) throw new ConflictError("Un compte existe déjà avec cet email");

  const slug = await uniqueSlug(input.organizationName);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug, city: input.city, country: input.country },
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
