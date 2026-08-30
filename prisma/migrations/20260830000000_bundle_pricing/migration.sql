-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "collectionId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "collectionId" TEXT;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
