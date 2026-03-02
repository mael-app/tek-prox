import axios from "axios";

const agentClient = axios.create({
  baseURL: process.env.AGENT_BASE_URL,
  headers: {
    "X-Agent-Key": process.env.AGENT_API_KEY ?? "",
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export async function setUnconfined(vmid: number, enable = true): Promise<void> {
  await agentClient.post("set-unconfined", { vmid, enable });
}

export async function injectSshKey(vmid: number, sshKey: string): Promise<void> {
  // Generous timeout: the agent may retry up to 8× with back-off (~53 s worst case)
  await agentClient.post("inject-ssh-key", { vmid, ssh_key: sshKey }, { timeout: 90_000 });
}

export async function checkAgentHealth(timeoutMs = 5000): Promise<boolean> {
  try {
    const res = await agentClient.get("health", { timeout: timeoutMs });
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}
