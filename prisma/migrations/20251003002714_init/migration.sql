-- CreateIndex
CREATE INDEX "Transfer_fromId_ts_idx" ON "Transfer"("fromId", "ts");

-- CreateIndex
CREATE INDEX "Transfer_toId_ts_idx" ON "Transfer"("toId", "ts");

-- CreateIndex
CREATE INDEX "Tx_userId_ts_idx" ON "Tx"("userId", "ts");
