export interface LxcCreateParams {
  vmid: number;
  hostname: string;
  ostemplate: string;
  memory: number; // MB
  cores: number;
  rootfs: string; // e.g. "local-lvm:8"
  net0: string; // e.g. "name=eth0,bridge=vmbr0,ip=192.168.1.x/24,gw=192.168.1.1"
  password?: string;
  unprivileged: number; // 0 or 1
  features?: string;
  start?: number;
  swap?: number; // MB, 0 = disabled
}

export interface LxcStatus {
  vmid: number;
  name: string;
  status: "running" | "stopped" | "paused";
  uptime?: number;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  net?: number;
  netin?: number;
  netout?: number;
  pid?: number;
}

export interface ProxmoxTask {
  upid: string;
  node: string;
  pid: number;
  starttime: number;
  type: string;
  id: string;
  user: string;
}

export interface TaskStatus {
  status: "running" | "stopped";
  exitstatus?: string;
}

export interface ProxmoxStorage {
  storage: string;
  content: string; // comma-separated, e.g. "images,rootdir,vztmpl"
  type: string;
}

export interface ProxmoxTemplate {
  volid: string; // e.g. "local:vztmpl/debian-12-standard.tar.zst"
  content: string;
  size: number;
  format?: string;
}

export interface ProxmoxNode {
  node: string;
  status: string;
  cpu: number;
  mem: number;
  maxmem: number;
  disk: number;
  maxdisk: number;
  uptime: number;
}
