-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "accentColor" TEXT NOT NULL DEFAULT '#E8622A',
    "heroModelUrl" TEXT,
    "heroModelName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- Seed the single row so the first read finds it rather than racing to
-- create it from several serverless instances at once.
INSERT INTO "StoreSettings" ("id", "accentColor", "updatedAt")
VALUES ('store', '#E8622A', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
