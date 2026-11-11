-- CreateTable
CREATE TABLE IF NOT EXISTS "economic_indicators" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "value" DECIMAL(6,3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "economic_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "economic_indicators_code_year_month_key" ON "economic_indicators"("code", "year", "month");
CREATE INDEX IF NOT EXISTS "economic_indicators_code_year_month_idx" ON "economic_indicators"("code", "year", "month");

