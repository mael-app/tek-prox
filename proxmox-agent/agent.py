#!/usr/bin/env python3
"""
tek-prox Proxmox Agent
Flask HTTP service running as root on the Proxmox host.
Performs privileged LXC operations on behalf of the Next.js app.
"""

import hmac
import os
import secrets
import shlex
import subprocess
from flask import Flask, Blueprint, request, jsonify

app = Flask(__name__)
agent = Blueprint("agent", __name__)

API_KEY = os.environ.get("AGENT_API_KEY", "")


def check_auth():
    """Validate X-Agent-Key header using constant-time comparison."""
    key = request.headers.get("X-Agent-Key", "")
    if not API_KEY:
        app.logger.warning("AGENT_API_KEY not set — all requests rejected")
        return False
    return secrets.compare_digest(key.encode(), API_KEY.encode())


def require_auth(f):
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        if not check_auth():
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)

    return decorated


@agent.route("/agent/health", methods=["GET"])
@require_auth
def health():
    return jsonify({"status": "ok"})


@agent.route("/agent/set-unconfined", methods=["POST"])
@require_auth
def set_unconfined():
    """
    Append AppArmor unconfined lines to /etc/pve/lxc/{vmid}.conf
    so the container can run Docker.
    """
    data = request.get_json(force=True)
    vmid = data.get("vmid")
    enable = data.get("enable", True)  # True to enable, False to disable
    if not vmid or not str(vmid).isdigit():
        return jsonify({"error": "Invalid vmid"}), 400

    vmid = int(vmid)
    conf_path = f"/etc/pve/lxc/{vmid}.conf"

    lines_to_manage = [
        "lxc.apparmor.profile: unconfined",
        "lxc.cgroup2.devices.allow: a",
        "lxc.cap.drop:",
        "lxc.mount.auto: proc:rw sys:rw",
    ]

    try:
        # Read existing config
        try:
            with open(conf_path, "r") as f:
                existing = f.read()
        except FileNotFoundError:
            return jsonify({"error": f"Config not found: {conf_path}"}), 404

        if enable:
            # Only append lines that aren't already present
            to_append = [
                line for line in lines_to_manage if line.split(":")[0] not in existing
            ]

            if to_append:
                with open(conf_path, "a") as f:
                    f.write("\n" + "\n".join(to_append) + "\n")

            app.logger.info(f"set-unconfined: vmid={vmid}, appended {len(to_append)} line(s)")
        else:
            # Remove Docker compatibility lines
            lines = existing.split("\n")
            filtered_lines = []
            removed_count = 0

            for line in lines:
                # Check if this line is one of the Docker compatibility lines
                should_remove = False
                for docker_line in lines_to_manage:
                    if line.strip().startswith(docker_line.split(":")[0]):
                        should_remove = True
                        removed_count += 1
                        break

                if not should_remove:
                    filtered_lines.append(line)

            # Write back the config without Docker compatibility lines
            with open(conf_path, "w") as f:
                f.write("\n".join(filtered_lines))

            app.logger.info(f"set-unconfined: vmid={vmid}, removed {removed_count} line(s)")

        return jsonify({"success": True, "changed": enable})

    except PermissionError:
        return jsonify({"error": "Permission denied"}), 500
    except Exception as e:
        app.logger.error(f"set-unconfined error: {e}")
        return jsonify({"error": str(e)}), 500


@agent.route("/agent/inject-ssh-key", methods=["POST"])
@require_auth
def inject_ssh_key():
    """
    Inject an SSH public key into /root/.ssh/authorized_keys inside the container
    using `pct exec`.
    """
    data = request.get_json(force=True)
    vmid = data.get("vmid")
    ssh_key = data.get("ssh_key", "").strip()

    if not vmid or not str(vmid).isdigit():
        return jsonify({"error": "Invalid vmid"}), 400
    if not ssh_key:
        return jsonify({"error": "ssh_key is required"}), 400
    if not (
        ssh_key.startswith("ssh-rsa ")
        or ssh_key.startswith("ssh-ed25519 ")
        or ssh_key.startswith("ecdsa-sha2-nistp")
        or ssh_key.startswith("sk-")
    ):
        return jsonify({"error": "Invalid SSH public key format"}), 400

    vmid = int(vmid)

    try:
        # Ensure .ssh directory exists
        subprocess.run(
            ["pct", "exec", str(vmid), "--", "mkdir", "-p", "/root/.ssh"],
            check=True,
            capture_output=True,
            text=True,
        )

        # Set permissions
        subprocess.run(
            ["pct", "exec", str(vmid), "--", "chmod", "700", "/root/.ssh"],
            check=True,
            capture_output=True,
            text=True,
        )

        # Check if key already exists to avoid duplicates
        result = subprocess.run(
            ["pct", "exec", str(vmid), "--", "cat", "/root/.ssh/authorized_keys"],
            capture_output=True,
            text=True,
        )
        existing_keys = result.stdout if result.returncode == 0 else ""

        if ssh_key in existing_keys:
            return jsonify({"success": True, "message": "Key already present"})

        # Append key
        subprocess.run(
            [
                "pct",
                "exec",
                str(vmid),
                "--",
                "sh",
                "-c",
                f'echo {shlex.quote(ssh_key)} >> /root/.ssh/authorized_keys',
            ],
            check=True,
            capture_output=True,
            text=True,
        )

        # Set authorized_keys permissions
        subprocess.run(
            ["pct", "exec", str(vmid), "--", "chmod", "600", "/root/.ssh/authorized_keys"],
            check=True,
            capture_output=True,
            text=True,
        )

        app.logger.info(f"inject-ssh-key: vmid={vmid}, key injected")
        return jsonify({"success": True})

    except subprocess.CalledProcessError as e:
        app.logger.error(f"inject-ssh-key pct exec error: {e.stderr}")
        return jsonify({"error": f"pct exec failed: {e.stderr}"}), 500
    except Exception as e:
        app.logger.error(f"inject-ssh-key error: {e}")
        return jsonify({"error": str(e)}), 500


app.register_blueprint(agent)

if __name__ == "__main__":
    port = int(os.environ.get("AGENT_PORT", 8765))
    host = os.environ.get("AGENT_HOST", "0.0.0.0")
    app.run(host=host, port=port, debug=False)
