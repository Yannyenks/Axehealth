import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateOrganizationProfile, signupOrganization, completeOnboarding } from "@/services/organization.service";

describe("Personnalisation de la clinique (profil organisation)", () => {
  let organizationId: string;
  const originalSlug = `test-org-profile-${Date.now()}`;

  beforeAll(async () => {
    const organization = await prisma.organization.create({ data: { name: "Nom initial", slug: originalSlug, country: "CM" } });
    organizationId = organization.id;
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("met à jour les coordonnées sans jamais toucher au slug", async () => {
    const updated = await updateOrganizationProfile(organizationId, {
      name: "Nouveau nom affiché",
      address: "12 Avenue de la Réunification",
      city: "Douala",
      phone: "+237233421010",
      email: "contact@clinique-demo.cm",
    });

    expect(updated.name).toBe("Nouveau nom affiché");
    expect(updated.city).toBe("Douala");
    expect(updated.phone).toBe("+237233421010");
    expect(updated.slug).toBe(originalSlug);
  });

  it("accepte le logo et la couleur de marque choisis pendant l'onboarding", async () => {
    const updated = await updateOrganizationProfile(organizationId, {
      logoUrl: "https://blob.example.com/logos/test.png",
      primaryColor: "#0d9488",
    });

    expect(updated.logoUrl).toBe("https://blob.example.com/logos/test.png");
    expect(updated.primaryColor).toBe("#0d9488");
  });
});

describe("Inscription self-service avec sélection d'offre", () => {
  let organizationId: string | undefined;
  let userEmail: string;

  afterAll(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("crée l'organisation avec l'offre choisie, une période d'essai, et l'onboarding non terminé", async () => {
    userEmail = `admin-${Date.now()}@test.axecompta.demo`;

    const { organization, user } = await signupOrganization({
      organizationName: "Clinique du Test",
      country: "CM",
      firstName: "Awa",
      lastName: "Fondatrice",
      email: userEmail,
      password: "SuperSecret123",
      plan: "PRO",
    });
    organizationId = organization.id;

    expect(organization.plan).toBe("PRO");
    expect(organization.onboardingCompletedAt).toBeNull();
    expect(organization.trialEndsAt).not.toBeNull();
    expect(organization.trialEndsAt!.getTime()).toBeGreaterThan(Date.now());
    expect(user.role).toBe("ADMIN");
  });

  it("marque l'onboarding comme terminé de façon idempotente", async () => {
    const first = await completeOnboarding(organizationId!);
    expect(first.onboardingCompletedAt).not.toBeNull();

    const second = await completeOnboarding(organizationId!);
    expect(second.onboardingCompletedAt!.getTime()).toBeGreaterThanOrEqual(first.onboardingCompletedAt!.getTime());
  });
});
