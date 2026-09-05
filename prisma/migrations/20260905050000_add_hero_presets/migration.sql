-- CreateTable
CREATE TABLE "HeroPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heroModelUrl" TEXT,
    "heroModelName" TEXT,
    "heroBoxLine" TEXT NOT NULL DEFAULT 'ANIMATION',
    "heroBoxNumber" TEXT NOT NULL DEFAULT '1000',
    "heroBoxBanner" TEXT NOT NULL DEFAULT 'DEMON SLAYER',
    "heroBoxName" TEXT NOT NULL DEFAULT 'TANJIRO',
    "heroBoxSubtitle" TEXT NOT NULL DEFAULT 'WITH NOODLES',
    "heroBoxCheckLight" TEXT NOT NULL DEFAULT '#1E5B4F',
    "heroBoxCheckDark" TEXT NOT NULL DEFAULT '#12181A',
    "heroBoxNumberColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HeroPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HeroPreset_name_key" ON "HeroPreset"("name");
