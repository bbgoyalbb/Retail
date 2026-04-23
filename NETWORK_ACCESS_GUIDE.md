# Retail App - Network Access Guide

This guide explains how to access the Retail Management app from different locations: same PC, local WiFi, and over the Internet.

---

## 1. Same PC (Local Only)

**Use when:** You are sitting at the computer running the app.

**How:**
1. Double-click `start_retail.bat`
2. Open your browser to `http://localhost:3000/`

**What happens:**
- Backend runs on `http://127.0.0.1:8001/`
- Frontend dev server runs on `http://localhost:3000/`
- No external access possible.

---

## 2. Same WiFi / Local Network (LAN)

**Use when:** You want to use the app on your phone, tablet, or another laptop connected to the same WiFi/router.

**How:**
1. Double-click `start_retail_network.bat`
2. It will print your local IP address, for example:
   ```
   Access from network: http://192.168.1.45:3000/
   ```
3. On your phone/tablet, open that address.

**Important:**
- Both devices must be on the **same network**.
- If it doesn't load, check **Windows Firewall** is allowing Node.js and Python through.

---

## 3. Over the Internet (WAN) — Anywhere in the World

**Use when:** You want to access the app from home while the shop PC is at the store, or let a remote employee use it.

### Option A: Static Public IP (Best)

Contact your Internet provider (ISP) and ask for a **Static Public IP address**. This usually costs a small monthly fee.

Once you have it:
1. Double-click `build_and_run.bat` on the shop PC.
2. Log in to your **WiFi router** admin page (usually `192.168.1.1` or `192.168.0.1`).
3. Go to **Port Forwarding** (also called Virtual Servers).
4. Add a rule:
   - **External Port:** `8001`
   - **Internal IP:** Your PC's local IP (e.g., `192.168.1.45`)
   - **Internal Port:** `8001`
   - **Protocol:** TCP
5. Save and restart the router.
6. Anyone can now open `http://YOUR_STATIC_PUBLIC_IP:8001/` from anywhere.

### Option B: Dynamic DNS (Free)

Most home/business internet connections have a **dynamic public IP** that changes every few days.

**Free solution:**
1. Sign up at [DuckDNS.org](https://www.duckdns.org/) or [No-IP.com](https://www.noip.com/).
2. Create a free hostname like `narwana-retail.duckdns.org`.
3. Install their small Windows client on your shop PC. It auto-updates the hostname whenever your public IP changes.
4. Set up **Port Forwarding** in your router (same steps as Option A).
5. Anyone can now open `http://narwana-retail.duckdns.org:8001/` from anywhere.

### Option C: Cloud VPS (Most Reliable)

If your shop internet is unreliable, rent a small cloud server:
- **DigitalOcean Droplet** ($6/month)
- **AWS Lightsail** ($5/month)
- **Hetzner Cloud** (~$4/month)

Steps:
1. Rent a Linux server.
2. Install Python, MongoDB, and Node.js on it.
3. Upload your project code to the server.
4. Run `build_and_run.bat` logic manually (build React, start uvicorn).
5. The server has a permanent public IP — no port forwarding needed.

---

## 4. Production Mode vs Development Mode

| Mode | Script | Frontend | Backend | Best For |
|------|--------|----------|---------|----------|
| Development | `start_retail.bat` | Dev server (slow, verbose) | Dev server | Coding/testing |
| Network Dev | `start_retail_network.bat` | Dev server on LAN | Dev server on LAN | Testing on phone |
| Production | `build_and_run.bat` | **Built static files** | Uvicorn production | **Real daily use** |

**Always use `build_and_run.bat` for actual shop operations.** It is faster, more stable, and uses only one port.

---

## 5. Firewall & Security Checklist

- [ ] Windows Defender Firewall allows **Python** (uvicorn) on Private + Public networks.
- [ ] Windows Defender Firewall allows **Node.js** (if using dev mode).
- [ ] Router Port Forwarding is set to your PC's local IP.
- [ ] You know your **public IP** (search "what is my IP" on Google).
- [ ] If exposing to the Internet, consider adding a simple login/password to the backend (currently open).

---

## 6. Quick Commands

**Build frontend only:**
```bash
cd frontend
npm run build
```

**Start backend only (production):**
```bash
cd backend
py -m uvicorn server:app --host 0.0.0.0 --port 8001
```

**Check if port 8001 is open:**
Open PowerShell and run:
```powershell
telnet YOUR_PUBLIC_IP 8001
```
Or use an online port checker website.
