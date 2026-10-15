import { db } from "@/lib/db";
import { getLxcIp } from "@/lib/agent";

const CACHE_TTL_MS = 30_000;
// How often lastIpSeenAt is refreshed in the DB while the IP is unchanged
const SEEN_WRITE_INTERVAL_MS = 5 * 60_000;

// vmid -> last lookup result. A null ip is cached too so stopped containers
// don't hit the agent on every request.
const cache = new Map<number, { ip: string | null; at: number }>();

/**
 * Current IPv4 of a container as reported by the host agent, or null if it is
 * stopped or has no lease yet. Results are cached for CACHE_TTL_MS.
 */
export async function getLiveIp(vmid: number): Promise<string | null> {
  const hit = cache.get(vmid);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ip;

  let ip: string | null = null;
  try {
    ip = await getLxcIp(vmid);
  } catch {
    // Agent unreachable — fall back to the last known IP
  }
  cache.set(vmid, { ip, at: Date.now() });
  return ip;
}

export function invalidateLiveIp(vmid: number) {
  cache.delete(vmid);
}

type InstanceWithIp = {
  id: string;
  vmid: number;
  networkMode: string;
  lastKnownIp: string | null;
  lastIpSeenAt: Date | null;
  ip: { address: string; gateway: string } | null;
};

export type ResolvedIp = {
  ipAddress: string | null;
  // true when the address is the last one seen, not confirmed live
  ipStale: boolean;
};

/**
 * Address to display for an instance: the allocated one for static
 * instances, the live (or last known) DHCP lease otherwise.
 */
export async function resolveInstanceIp(instance: InstanceWithIp): Promise<ResolvedIp> {
  if (instance.networkMode !== "dhcp") {
    return { ipAddress: instance.ip?.address ?? null, ipStale: false };
  }

  const live = await getLiveIp(instance.vmid);
  if (!live) {
    return { ipAddress: instance.lastKnownIp, ipStale: !!instance.lastKnownIp };
  }

  const seenRecently =
    instance.lastIpSeenAt &&
    Date.now() - instance.lastIpSeenAt.getTime() < SEEN_WRITE_INTERVAL_MS;
  if (live !== instance.lastKnownIp || !seenRecently) {
    await db.instance.update({
      where: { id: instance.id },
      data: { lastKnownIp: live, lastIpSeenAt: new Date() },
    });
  }
  return { ipAddress: live, ipStale: false };
}

export async function withResolvedIp<T extends InstanceWithIp>(instance: T) {
  return { ...instance, ...(await resolveInstanceIp(instance)) };
}
