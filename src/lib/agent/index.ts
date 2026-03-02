import axios from "axios";

const agentClient = axios.create({
  baseURL: process.env.AGENT_BASE_URL,
  headers: {
    "X-Agent-Key": process.env.AGENT_API_KEY ?? "",
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

export async function setUnconfined(vmid: number): Promise<void> {
  await agentClient.post("/agent/set-unconfined", { vmid });
}

export async function injectSshKey(vmid: number, sshKey: string): Promise<void> {
  await agentClient.post("/agent/inject-ssh-key", { vmid, ssh_key: sshKey });
}

export async function checkAgentHealth(): Promise<boolean> {
  try {
    const res = await agentClient.get("/agent/health");
    return res.data?.status === "ok";
  } catch {
    return false;
  }
}
