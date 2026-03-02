import { db } from "@/lib/db";

function ipToInt(ip: string): number {
  return ip
    .split(".")
    .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(n: number): string {
  return [
    (n >>> 24) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 8) & 0xff,
    n & 0xff,
  ].join(".");
}

/**
 * Expand a start-end IP range into an array of address strings.
 */
export function expandRange(startIp: string, endIp: string): string[] {
  const start = ipToInt(startIp);
  const end = ipToInt(endIp);
  const addresses: string[] = [];
  for (let i = start; i <= end; i++) {
    addresses.push(intToIp(i));
  }
  return addresses;
}

/**
 * Atomically claim the first free IP address for a given instance.
 * Returns the IpAddress record or null if none available.
 */
export async function allocateIp(instanceId: string) {
  // Find first unallocated address
  const free = await db.ipAddress.findFirst({
    where: { instanceId: null },
    orderBy: { createdAt: "asc" },
  });

  if (!free) return null;

  // Atomically claim it
  const updated = await db.ipAddress.updateMany({
    where: { id: free.id, instanceId: null },
    data: { instanceId },
  });

  if (updated.count === 0) {
    // Race condition - retry once
    return allocateIp(instanceId);
  }

  return db.ipAddress.findUnique({ where: { id: free.id } });
}

/**
 * Release an IP address (set instanceId to null).
 */
export async function releaseIp(instanceId: string) {
  await db.ipAddress.updateMany({
    where: { instanceId },
    data: { instanceId: null },
  });
}
