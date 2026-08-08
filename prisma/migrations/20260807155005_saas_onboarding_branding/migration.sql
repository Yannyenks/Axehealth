-- CreateEnum
CREATE TYPE "OrgPlan" AS ENUM ('STARTER', 'PRO', 'ENTERPRISE');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3),
ADD COLUMN     "plan" "OrgPlan" NOT NULL DEFAULT 'STARTER',
ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);
