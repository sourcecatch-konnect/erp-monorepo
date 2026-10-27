-- Training (role-based onboarding): role profiles, role → track assignments,
-- per-user step progress. Additive only.

-- CreateEnum
CREATE TYPE "TrainingStepStatus" AS ENUM ('DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TrainingCompletedBy" AS ENUM ('SELF', 'SYSTEM');

-- CreateTable
CREATE TABLE "TrainingRoleProfile" (
    "roleId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "responsibilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingRoleProfile_pkey" PRIMARY KEY ("roleId")
);

-- CreateTable
CREATE TABLE "TrainingRoleTrack" (
    "roleId" TEXT NOT NULL,
    "trackKey" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRoleTrack_pkey" PRIMARY KEY ("roleId","trackKey")
);

-- CreateTable
CREATE TABLE "TrainingProgress" (
    "userId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "status" "TrainingStepStatus" NOT NULL,
    "completedBy" "TrainingCompletedBy" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingProgress_pkey" PRIMARY KEY ("userId","stepKey")
);


-- AddForeignKey
ALTER TABLE "TrainingRoleProfile" ADD CONSTRAINT "TrainingRoleProfile_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRoleTrack" ADD CONSTRAINT "TrainingRoleTrack_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProgress" ADD CONSTRAINT "TrainingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

