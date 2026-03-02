# tek-prox Proxmox Agent

Flask HTTP service running as root on the Proxmox host. Performs privileged LXC operations (AppArmor patching, SSH key injection) on behalf of the Next.js application.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
export AGENT_API_KEY="your-secret-key-here"
export AGENT_PORT=8765       # optional, default 8765
export AGENT_HOST=0.0.0.0    # optional, default 0.0.0.0
```

## Running

**Development:**
```bash
python agent.py
```

**Production (systemd service):**

Create `/etc/systemd/system/tek-prox-agent.service`:
```ini
[Unit]
Description=tek-prox Proxmox Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tek-prox-agent
Environment=AGENT_API_KEY=your-secret-key-here
Environment=AGENT_PORT=8765
ExecStart=/usr/bin/gunicorn -w 2 -b 0.0.0.0:8765 agent:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable tek-prox-agent
systemctl start tek-prox-agent
```

## Endpoints

### `GET /health`
Liveness check.

**Response:** `{"status": "ok"}`

---

### `POST /set-unconfined`
Appends AppArmor unconfined lines to `/etc/pve/lxc/{vmid}.conf` to enable Docker inside the container.

**Request body:**
```json
{"vmid": 200}
```

**Response:** `{"success": true, "appended": 4}`

Lines added:
```
lxc.apparmor.profile: unconfined
lxc.cgroup2.devices.allow: a
lxc.cap.drop:
lxc.mount.auto: proc:rw sys:rw
```

---

### `POST /inject-ssh-key`
Injects an SSH public key into `/root/.ssh/authorized_keys` inside the container using `pct exec`.

**Request body:**
```json
{
  "vmid": 200,
  "ssh_key": "ssh-ed25519 AAAA... user@host"
}
```

**Response:** `{"success": true}`

## Authentication

All requests require the `X-Agent-Key` header matching `AGENT_API_KEY`. Comparison uses `secrets.compare_digest` to prevent timing attacks.

```bash
curl -H "X-Agent-Key: your-secret-key" http://proxmox-host:8765/health
```

## Security Notes

- Bind to a private interface (not `0.0.0.0`) in production, or use firewall rules to restrict access
- The agent runs as root — only expose it to trusted clients (the Next.js app server)
- Rotate `AGENT_API_KEY` periodically
