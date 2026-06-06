# GEN410 Web App

React-based control panel for the Gen410 ESP32 generator controller.
Communicates via MQTT over WebSocket — works from anywhere in the world.

---

## Setup (one-time, ~10 minutes)

### 1 — Create a free HiveMQ Cloud cluster
1. Go to **https://www.hivemq.com/mqtt-cloud/** and sign up (free)
2. Create a cluster → note the **Cluster URL** (e.g. `abc123.s1.eu.hivemq.cloud`)
3. Under **Access Management**, create a credential:
   - Username: `gen410`
   - Password: *(choose something strong)*

### 2 — Configure the ESP32 sketch
Open `Gen410/Gen410.ino` and update these three lines:
```cpp
#define MQTT_HOST  "abc123.s1.eu.hivemq.cloud"   // your cluster URL
#define MQTT_USER  "gen410"
#define MQTT_PASS  "YOUR_PASSWORD"
```
Compile and upload.

### 3 — Run the web app locally
```bash
cd gen410-web
cp .env.example .env
# Edit .env with your cluster URL and credentials
npm install
npm run dev
```
Open http://localhost:5173

### 4 — Deploy to Netlify (free)
1. Push this folder to a GitHub repo
2. Go to **https://app.netlify.com** → "Add new site" → "Import from Git"
3. Select the repo, set:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Under **Site Settings → Environment Variables**, add:
   - `VITE_MQTT_URL` = `wss://abc123.s1.eu.hivemq.cloud:8884/mqtt`
   - `VITE_MQTT_USER` = `gen410`
   - `VITE_MQTT_PASS` = your password
5. Trigger a deploy → your app is live at `https://your-site.netlify.app`

---

## MQTT Topics

| Topic | Direction | Payload example |
|---|---|---|
| `gen410/status` | ESP32 → App | `{"state":3,"power":true,"elapsed":12000,"uptime":86000}` |
| `gen410/relays` | ESP32 → App | `{"r1":true,"r2":false,"r3":false,"r4":false,"manual":false,"kd":42,...}` |
| `gen410/cmd/relay` | App → ESP32 | `{"relay":1,"state":1}` |
| `gen410/cmd/mode` | App → ESP32 | `{"manual":1}` |
| `gen410/cmd/save` | App → ESP32 | `{"keyDelay":42,"crankDur":3,"stopDur":5,"keyOffDly":5}` |

## State Reference

| # | Name | Description |
|---|---|---|
| 0 | IDLE | Mains present, generator off |
| 1 | KEY WAIT | Key relay on, warming before crank |
| 2 | CRANKING | Start relay active |
| 3 | RUNNING | Generator running, mains absent |
| 4 | STOPPING | Stop relay active |
| 5 | STOP WAIT | Cooldown before key off |
