import axios, { AxiosInstance } from "axios";
import https from "https";
import type { LxcCreateParams, LxcStatus, ProxmoxStorage, ProxmoxTemplate, TaskStatus } from "./types";

class ProxmoxClient {
  private client: AxiosInstance;
  private node: string;

  constructor() {
    const host = process.env.PROXMOX_HOST!;
    const tokenId = process.env.PROXMOX_TOKEN_ID!;
    const tokenSecret = process.env.PROXMOX_TOKEN_SECRET!;
    const verifySsl = process.env.PROXMOX_VERIFY_SSL !== "false";

    this.node = process.env.PROXMOX_NODE ?? "pve";

    this.client = axios.create({
      baseURL: `${host}/api2/json`,
      headers: {
        Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
        "Content-Type": "application/json",
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: verifySsl }),
    });
  }

  async createLxc(params: LxcCreateParams): Promise<string> {
    const res = await this.client.post(
      `/nodes/${this.node}/lxc`,
      params
    );
    return res.data.data as string; // UPID
  }

  async waitForTask(
    upid: string,
    timeoutMs = 60000,
    pollMs = 2000
  ): Promise<void> {
    const encoded = encodeURIComponent(upid);
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollMs));
      const res = await this.client.get<{ data: TaskStatus }>(
        `/nodes/${this.node}/tasks/${encoded}/status`
      );
      const task = res.data.data;
      if (task.status === "stopped") {
        if (task.exitstatus && task.exitstatus !== "OK") {
          throw new Error(`Proxmox task failed: ${task.exitstatus}`);
        }
        return;
      }
    }
    throw new Error("Proxmox task timed out");
  }

  async startLxc(vmid: number): Promise<string> {
    const res = await this.client.post(
      `/nodes/${this.node}/lxc/${vmid}/status/start`
    );
    return res.data.data as string;
  }

  async stopLxc(vmid: number): Promise<string> {
    const res = await this.client.post(
      `/nodes/${this.node}/lxc/${vmid}/status/stop`
    );
    return res.data.data as string;
  }

  async deleteLxc(vmid: number): Promise<string> {
    const res = await this.client.delete(
      `/nodes/${this.node}/lxc/${vmid}`
    );
    return res.data.data as string;
  }

  async getLxcStatus(vmid: number): Promise<LxcStatus> {
    const res = await this.client.get<{ data: LxcStatus }>(
      `/nodes/${this.node}/lxc/${vmid}/status/current`
    );
    return res.data.data;
  }

  async listLxcs(): Promise<LxcStatus[]> {
    const res = await this.client.get<{ data: LxcStatus[] }>(
      `/nodes/${this.node}/lxc`
    );
    return res.data.data;
  }

  async getNextVmid(options?: { timeout?: number }): Promise<number> {
    const res = await this.client.get<{ data: number }>("/cluster/nextid", {
      timeout: options?.timeout,
    });
    return res.data.data;
  }

  async listStorages(): Promise<ProxmoxStorage[]> {
    const res = await this.client.get<{ data: ProxmoxStorage[] }>(
      `/nodes/${this.node}/storage`
    );
    return res.data.data;
  }

  async listTemplates(storage: string): Promise<ProxmoxTemplate[]> {
    const res = await this.client.get<{ data: ProxmoxTemplate[] }>(
      `/nodes/${this.node}/storage/${storage}/content`,
      { params: { content: "vztmpl" } }
    );
    return res.data.data;
  }
}

let instance: ProxmoxClient | null = null;

export function getProxmoxClient(): ProxmoxClient {
  if (!instance) instance = new ProxmoxClient();
  return instance;
}
