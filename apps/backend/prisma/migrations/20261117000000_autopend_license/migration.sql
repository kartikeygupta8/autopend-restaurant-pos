-- CreateTable
CREATE TABLE "autopend_license" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "message" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autopend_license_pkey" PRIMARY KEY ("id")
);
