-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'global',
    "storage" TEXT NOT NULL DEFAULT 'local-lvm',
    "bridge" TEXT NOT NULL DEFAULT 'vmbr0',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OsTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Group" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "maxRamMb" INTEGER NOT NULL DEFAULT 512,
    "maxCpuCores" INTEGER NOT NULL DEFAULT 1,
    "maxDiskGb" INTEGER NOT NULL DEFAULT 8,
    "maxInstances" INTEGER NOT NULL DEFAULT 1,
    "maxSwapMb" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Group" ("createdAt", "description", "id", "isAdmin", "maxCpuCores", "maxDiskGb", "maxInstances", "maxRamMb", "name", "updatedAt") SELECT "createdAt", "description", "id", "isAdmin", "maxCpuCores", "maxDiskGb", "maxInstances", "maxRamMb", "name", "updatedAt" FROM "Group";
DROP TABLE "Group";
ALTER TABLE "new_Group" RENAME TO "Group";
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");
CREATE TABLE "new_Instance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vmid" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "ramMb" INTEGER NOT NULL,
    "cpuCores" INTEGER NOT NULL,
    "diskGb" INTEGER NOT NULL,
    "swapMb" INTEGER NOT NULL DEFAULT 0,
    "osTemplate" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Instance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Instance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Instance" ("cpuCores", "createdAt", "diskGb", "groupId", "id", "name", "node", "osTemplate", "ramMb", "status", "updatedAt", "userId", "vmid") SELECT "cpuCores", "createdAt", "diskGb", "groupId", "id", "name", "node", "osTemplate", "ramMb", "status", "updatedAt", "userId", "vmid" FROM "Instance";
DROP TABLE "Instance";
ALTER TABLE "new_Instance" RENAME TO "Instance";
CREATE UNIQUE INDEX "Instance_vmid_key" ON "Instance"("vmid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OsTemplate_template_key" ON "OsTemplate"("template");
