-- CreateEnum
CREATE TYPE "AlertMetric" AS ENUM ('CA_JOUR', 'CREANCES_ASSURANCES', 'TAUX_OCCUPATION_LITS', 'STOCK_JOURS_AVANT_PEREMPTION', 'STOCK_SOUS_SEUIL_REAPPRO', 'ECART_CAISSE_CLOTURE');

-- CreateEnum
CREATE TYPE "AlertOperator" AS ENUM ('SUPERIEUR_A', 'INFERIEUR_A');

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "metric" "AlertMetric" NOT NULL,
    "operator" "AlertOperator" NOT NULL,
    "threshold" DECIMAL(14,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notifyRoles" "Role"[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertTriggerLog" (
    "id" TEXT NOT NULL,
    "alertRuleId" TEXT NOT NULL,
    "value" DECIMAL(14,2) NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertTriggerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_organizationId_idx" ON "AlertRule"("organizationId");

-- CreateIndex
CREATE INDEX "AlertRule_organizationId_isActive_idx" ON "AlertRule"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "AlertTriggerLog_alertRuleId_idx" ON "AlertTriggerLog"("alertRuleId");

-- CreateIndex
CREATE INDEX "AlertTriggerLog_alertRuleId_triggeredAt_idx" ON "AlertTriggerLog"("alertRuleId", "triggeredAt");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertTriggerLog" ADD CONSTRAINT "AlertTriggerLog_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
