#!/usr/bin/env ts-node
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";
import readline from "readline";

// Initialize Prisma Client
function resolveDbUrl(): string {
  const url = (process.env.DATABASE_URL ?? "file:./dev.db")
    .trim()
    .replace(/^["']|["']$/g, "");
  const filePath = url.startsWith("file:") ? url.slice(5) : url;
  const absolute = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
  return `file:${absolute}`;
}

// Create readline interface for user input
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function question(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  const rl = createReadlineInterface();
  const adapter = new PrismaBetterSqlite3({ url: resolveDbUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log("\n🔧 Tek-Prox Setup - Create Admin Group for User\n");

    // Get user input
    const email = await question(rl, "Enter user email address: ");
    const groupName = await question(rl, "Enter admin group name (default: 'Admins'): ");
    const groupDesc = await question(rl, "Enter group description (optional): ");

    const finalGroupName = groupName.trim() || "Admins";
    const finalGroupDesc = groupDesc.trim() || "Administrator group";

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.trim() },
    });

    if (!user) {
      console.error(`\n❌ Error: User with email "${email}" not found.`);
      console.log("Please ensure the user has logged in at least once.\n");
      rl.close();
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`\n✓ Found user: ${user.name || user.email}`);

    // Check if admin group exists, if not create it
    let adminGroup = await prisma.group.findUnique({
      where: { name: finalGroupName },
    });

    if (!adminGroup) {
      console.log(`\nCreating admin group "${finalGroupName}"...`);
      adminGroup = await prisma.group.create({
        data: {
          name: finalGroupName,
          description: finalGroupDesc,
          isAdmin: true,
          maxRamMb: 999999,
          maxCpuCores: 999999,
          maxDiskGb: 999999,
          maxInstances: 999999,
          maxSwapMb: 999999,
        },
      });
      console.log(`✓ Admin group "${finalGroupName}" created`);
    } else {
      console.log(`✓ Admin group "${finalGroupName}" already exists`);
    }

    // Check if user is already a member of the group
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: {
          userId: user.id,
          groupId: adminGroup.id,
        },
      },
    });

    if (existingMember) {
      console.log(`\n⚠️  User "${user.email}" is already a member of "${finalGroupName}"`);
    } else {
      // Add user to admin group
      await prisma.groupMember.create({
        data: {
          userId: user.id,
          groupId: adminGroup.id,
        },
      });
      console.log(`✓ User "${user.email}" added to "${finalGroupName}" group`);
    }

    console.log("\n✨ Setup completed successfully!\n");
  } catch (error) {
    console.error("\n❌ Setup failed:", error);
    rl.close();
    await prisma.$disconnect();
    process.exit(1);
  }

  rl.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

