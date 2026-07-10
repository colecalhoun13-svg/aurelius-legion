-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_operatorId_fkey";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "actualMinutes" INTEGER,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "domain" TEXT NOT NULL DEFAULT 'personal',
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "estimatedMinutes" INTEGER,
ADD COLUMN     "goalId" TEXT,
ADD COLUMN     "origin" TEXT NOT NULL DEFAULT 'cole',
ADD COLUMN     "originContext" JSONB,
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'normal',
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3),
ALTER COLUMN "operatorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "projectId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "measure" JSONB,
    "horizon" TEXT NOT NULL DEFAULT 'quarter',
    "status" TEXT NOT NULL DEFAULT 'active',
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "name" TEXT NOT NULL,
    "cadence" TEXT NOT NULL DEFAULT 'daily',
    "cronExpression" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" TEXT NOT NULL,
    "habitId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "HabitCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "title" TEXT,
    "content" TEXT NOT NULL,
    "captureContext" TEXT,
    "linkedTaskIds" TEXT[],
    "linkedProjectIds" TEXT[],
    "linkedMemoryIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyPlan" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "operatorId" TEXT,
    "generatedBy" TEXT NOT NULL DEFAULT 'cole_manual',
    "headline" TEXT,
    "focus" TEXT,
    "taskIds" TEXT[],
    "ritualIds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ritual" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "templateJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ritual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RitualInstance" (
    "id" TEXT NOT NULL,
    "ritualId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "firedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "outputText" TEXT,
    "outputStructured" JSONB,
    "deliveredVia" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RitualInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT NOT NULL DEFAULT 'personal',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "attendees" JSONB,
    "linkedTaskIds" TEXT[],
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw" JSONB,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BridgeSignal" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "operatorId" TEXT,
    "domain" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "surfacedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BridgeSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentActionGap" (
    "id" TEXT NOT NULL,
    "goalId" TEXT,
    "projectId" TEXT,
    "domain" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "intent" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "gapScore" DOUBLE PRECISION NOT NULL,
    "gapSummary" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntentActionGap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_status_priority_idx" ON "Project"("status", "priority");

-- CreateIndex
CREATE INDEX "Project_domain_status_idx" ON "Project"("domain", "status");

-- CreateIndex
CREATE INDEX "Goal_status_horizon_idx" ON "Goal"("status", "horizon");

-- CreateIndex
CREATE INDEX "Habit_active_idx" ON "Habit"("active");

-- CreateIndex
CREATE INDEX "HabitCompletion_habitId_completedAt_idx" ON "HabitCompletion"("habitId", "completedAt");

-- CreateIndex
CREATE INDEX "Note_createdAt_idx" ON "Note"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyPlan_date_key" ON "DailyPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Ritual_name_key" ON "Ritual"("name");

-- CreateIndex
CREATE INDEX "RitualInstance_ritualId_scheduledFor_idx" ON "RitualInstance"("ritualId", "scheduledFor");

-- CreateIndex
CREATE INDEX "RitualInstance_status_scheduledFor_idx" ON "RitualInstance"("status", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_externalId_key" ON "CalendarEvent"("externalId");

-- CreateIndex
CREATE INDEX "CalendarEvent_startAt_idx" ON "CalendarEvent"("startAt");

-- CreateIndex
CREATE INDEX "BridgeSignal_status_createdAt_idx" ON "BridgeSignal"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BridgeSignal_kind_status_idx" ON "BridgeSignal"("kind", "status");

-- CreateIndex
CREATE INDEX "IntentActionGap_domain_computedAt_idx" ON "IntentActionGap"("domain", "computedAt");

-- CreateIndex
CREATE INDEX "Task_operatorId_status_idx" ON "Task"("operatorId", "status");

-- CreateIndex
CREATE INDEX "Task_status_scheduledFor_idx" ON "Task"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCompletion" ADD CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyPlan" ADD CONSTRAINT "DailyPlan_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RitualInstance" ADD CONSTRAINT "RitualInstance_ritualId_fkey" FOREIGN KEY ("ritualId") REFERENCES "Ritual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeSignal" ADD CONSTRAINT "BridgeSignal_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

