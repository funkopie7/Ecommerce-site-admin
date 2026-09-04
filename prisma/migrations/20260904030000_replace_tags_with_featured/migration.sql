-- Replace the Tag vocabulary and Product.badges with a single `featured` flag.
--
-- Destructive by request, and the data says why: of 508 products exactly one
-- carried any badge, so the Featured drops row the badges were meant to fill
-- was in practice populated by an arbitrary stride through the catalogue.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;

-- Carry over what little intent the badges expressed, so the drops row starts
-- with the products that were actually marked rather than empty.
UPDATE "Product" SET "featured" = true
WHERE "badges" && ARRAY['NEW', 'LIMITED', 'PRE_ORDER', 'FAN_FAVORITE'];

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "badges";

-- DropTable
DROP TABLE "Tag";
