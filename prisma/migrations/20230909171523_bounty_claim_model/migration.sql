-- CreateTable
CREATE TABLE "BountyClaim" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fk_user_id" TEXT NOT NULL,
    "fk_bounty_id" TEXT NOT NULL,

    CONSTRAINT "BountyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BountyClaim_fk_user_id_key" ON "BountyClaim"("fk_user_id");
