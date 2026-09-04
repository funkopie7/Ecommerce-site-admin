-- AlterTable: a Google account has no password to hash.
ALTER TABLE "Customer" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "Customer" ADD COLUMN     "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");
