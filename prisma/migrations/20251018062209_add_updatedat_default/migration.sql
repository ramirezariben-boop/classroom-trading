/*
  Warnings:

  - You are about to alter the column `amount` on the `Transfer` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Int`.
  - You are about to alter the column `points` on the `User` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Position" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "valueId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Position" ("id", "qty", "userId", "valueId") SELECT "id", "qty", "userId", "valueId" FROM "Position";
DROP TABLE "Position";
ALTER TABLE "new_Position" RENAME TO "Position";
CREATE UNIQUE INDEX "Position_userId_valueId_key" ON "Position"("userId", "valueId");
CREATE TABLE "new_Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT,
    "toId" TEXT,
    "amount" INTEGER NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transfer_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transfer" ("amount", "fromId", "id", "toId", "ts") SELECT "amount", "fromId", "id", "toId", "ts" FROM "Transfer";
DROP TABLE "Transfer";
ALTER TABLE "new_Transfer" RENAME TO "Transfer";
CREATE INDEX "Transfer_ts_idx" ON "Transfer"("ts");
CREATE INDEX "Transfer_fromId_ts_idx" ON "Transfer"("fromId", "ts");
CREATE INDEX "Transfer_toId_ts_idx" ON "Transfer"("toId", "ts");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1000,
    "username" TEXT,
    "day" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("codeHash", "createdAt", "id", "name", "points") SELECT "codeHash", "createdAt", "id", "name", "points" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE INDEX "User_day_idx" ON "User"("day");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
