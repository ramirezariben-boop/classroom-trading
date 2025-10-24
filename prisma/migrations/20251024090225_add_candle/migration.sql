-- CreateTable
CREATE TABLE "Candle" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION,

    CONSTRAINT "Candle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candle_ticker_timeframe_ts_idx" ON "Candle"("ticker", "timeframe", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "Candle_ticker_timeframe_ts_key" ON "Candle"("ticker", "timeframe", "ts");
