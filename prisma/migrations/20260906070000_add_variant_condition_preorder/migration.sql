-- AlterTable
ALTER TABLE "Product" ADD COLUMN "variantType" TEXT NOT NULL DEFAULT 'Common';
ALTER TABLE "Product" ADD COLUMN "condition" TEXT NOT NULL DEFAULT 'Mint';
ALTER TABLE "Product" ADD COLUMN "isPreorder" BOOLEAN NOT NULL DEFAULT false;
