# ◎ Axiom — Hyper-Local Civic Intelligence Platform

A geo-fencing web application that brings transparency to public infrastructure development. Admins mark development sites on a live map with geo-fence zones, and civilians receive real-time proximity notifications when they are near active projects.

---

## 🚀 Quick Start — Run Locally

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Gotnochill/axiom.git
cd axiom

# 2. Install dependencies
npm install

# 3. Start the server
npm start
```

The server will start at:

```
⚡ http://localhost:3000
```

### What You'll See

| URL | View |
|-----|------|
| `http://localhost:3000` | Landing page — choose Admin or Civilian |
| `http://localhost:3000/admin.html` | Admin Dashboard — manage development sites on the map |
| `http://localhost:3000/civilian.html` | Civilian Dashboard — see nearby projects + get alerts |

> **Note:** When opening the Civilian view, your browser will ask for **location permission**. Grant it to enable proximity-based notifications.

---

## 🌐 Deploy Online

This app is a standalone Node.js server and can be deployed on any platform that supports Node (Render, Railway, Fly.io, etc.).

| Setting | Value |
|---------|-------|
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Port** | `3000` (or set `PORT` env variable) |

> **Important:** For browser geolocation and notifications to work in production, the site **must** be served over **HTTPS**. All major deployment platforms handle this automatically.

---

## 📖 How It Works

### System Overview

```
┌──────────────┐         REST API          ┌──────────────┐
│              │  ◄───────────────────────► │              │
│  Admin UI    │   POST/PUT/DELETE /sites   │   Express    │
│  (Leaflet)   │                            │   Server     │
│              │                            │              │
└──────────────┘                            │  In-memory   │
                                            │  data store  │
┌──────────────┐         REST API          │              │
│              │  ◄───────────────────────► │              │
│ Civilian UI  │     GET /api/sites         └──────────────┘
│ (Leaflet +   │
│  Geolocation)│
└──────────────┘
```

### The Two Roles

#### 🛠 Administrator

The admin dashboard provides a full-screen interactive map with a sidebar control panel.

**What the admin can do:**
1. **Click anywhere on the map** to place a pin — the latitude and longitude are auto-captured into the form
2. **Fill project details** — name, type (Hospital, Road, Bridge, College, Railway, etc.), description of civic impact, and current status
3. **Set a geo-fence radius** (in meters) — this defines the zone around the site where civilians will be notified
4. **View, edit, and delete** existing sites from the sidebar list
5. **Click on any site in the list** to fly to its location on the map

All data is managed through a REST API (`POST /api/sites`, `PUT /api/sites/:id`, `DELETE /api/sites/:id`).

#### 📍 Civilian

The civilian dashboard is a read-only view designed for citizens passing through areas with active development.

**What happens when a civilian opens the page:**
1. The browser requests **location permission** via the Geolocation API
2. A blue pulsing marker appears at the user's real GPS position
3. All registered development sites load from the server and appear as markers with geo-fence circles on the map
4. The sidebar lists every project, **sorted by distance** from the user
5. If the user is **inside a site's geo-fence radius**, they receive a **browser notification** and an in-app alert

---

## 🔲 How Geo-Fencing Works

This is the core mechanism of the application. Here's exactly how it's implemented:

### Step 1 — Admin Defines Geo-Fence Zones

When an admin creates a development site, they specify:
- **Latitude & Longitude** — the center point of the project (captured by clicking on the map)
- **Radius** — the geo-fence boundary in meters (default: 500m)

This data is stored on the server as a simple object:

```json
{
  "id": 1,
  "name": "City Hospital Wing B",
  "type": "Hospital",
  "lat": 13.0827,
  "lng": 80.2707,
  "radius": 500,
  "status": "In Progress",
  "description": "New wing with 200 beds..."
}
```

On the map, each site is visualized as:
- A **colored dot marker** at the center point
- A **dashed circle** showing the geo-fence boundary (radius in meters)
  - 🟡 Yellow/dashed = In Progress
  - 🟢 Green/solid = Completed

### Step 2 — Civilian's Location Is Tracked

When a civilian opens their dashboard, the app uses the **Browser Geolocation API**:

```javascript
navigator.geolocation.watchPosition(callback, errorCallback, {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000
});
```

Key points:
- `watchPosition` (not `getCurrentPosition`) is used — this **continuously tracks** the user's location as they move
- `enableHighAccuracy: true` requests GPS-level precision (important on mobile)
- The position updates every few seconds automatically

### Step 3 — Distance Calculation (Haversine Formula)

Every time the user's position updates, the app calculates the distance between the user and **every** development site using the **Haversine formula**:

```
a = sin²(Δlat/2) + cos(lat₁) · cos(lat₂) · sin²(Δlng/2)
distance = 2 · R · atan2(√a, √(1−a))
```

Where `R = 6,371,000 meters` (Earth's radius).

This gives the **great-circle distance** — the shortest distance between two points on a sphere — which is accurate enough for geo-fencing at these scales.

### Step 4 — Proximity Check (The Geo-Fence Trigger)

The check itself is straightforward:

```
Is the user inside the geo-fence?

→ distance(user, site) ≤ site.radius
```

If **yes** → the user has **entered the geo-fence**.

The app also implements **hysteresis** to avoid notification spam: once a notification fires for a site, it won't fire again until the user has moved **outside the radius by 10%** (i.e., `distance > radius × 1.1`), and then re-enters.

### Step 5 — Notification Delivery

When a user enters a geo-fence, two things happen simultaneously:

1. **Browser Notification** (system-level):
   ```javascript
   new Notification("📍 City Hospital Wing B", {
     body: "Hospital · In Progress\nNew wing with 200 beds..."
   });
   ```
   This appears as an OS-level notification even if the browser tab is not in focus.

2. **In-app alert**: The sidebar highlights the site with a green "🟢 Inside geo-fence" indicator and shows the project details.

### Continuous Monitoring

The system re-checks proximity on every location update. Additionally, the civilian dashboard **polls the server every 15 seconds** for new/updated sites, so if an admin adds a new project while a civilian is nearby, they'll be notified within seconds.

```
┌─────────────┐   watchPosition    ┌──────────────┐    ≤ radius?    ┌──────────────┐
│ GPS / Wi-Fi │ ─────────────────► │  Haversine   │ ─────────────► │  Browser     │
│ Location    │   (continuous)     │  Distance    │   YES          │  Notification│
│             │                    │  Calculator  │                │  + In-app UI │
└─────────────┘                    └──────────────┘                └──────────────┘
                                         ▲
                                         │ GET /api/sites (every 15s)
                                   ┌─────┴────────┐
                                   │  Express API  │
                                   └──────────────┘
```

---

## 📁 Project Structure

```
axiom/
├── server.js              # Express server + REST API (in-memory store)
├── package.json           # Dependencies and scripts
├── .gitignore
└── public/
    ├── index.html         # Landing page with role selection
    ├── admin.html         # Admin dashboard
    ├── civilian.html      # Civilian dashboard
    ├── css/
    │   └── style.css      # Full design system (dark theme)
    └── js/
        ├── admin.js       # Map interaction, CRUD, marker management
        └── civilian.js    # Geolocation, Haversine, notifications
```

---

## ⚙️ API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/sites` | List all development sites |
| `GET` | `/api/sites/:id` | Get a single site |
| `POST` | `/api/sites` | Create a new site |
| `PUT` | `/api/sites/:id` | Update a site |
| `DELETE` | `/api/sites/:id` | Delete a site |

**POST/PUT body:**
```json
{
  "name": "Project Name",
  "type": "Hospital",
  "description": "Civic impact description",
  "status": "In Progress",
  "lat": 13.0827,
  "lng": 80.2707,
  "radius": 500
}
```

---

## 🔧 Technical Notes

- **Storage**: In-memory (JavaScript array). Data resets on server restart. For production, wire up a database (MongoDB, PostgreSQL, etc.)
- **Authentication**: Stub only (role selection). For production, add proper auth (JWT, OAuth, etc.)
- **Maps**: Leaflet.js with CARTO Dark tiles — no API key required
- **Notifications**: Requires user to grant both Location and Notification permissions in the browser
- **HTTPS**: Required in production for Geolocation API to work (all PaaS platforms provide this by default)

---

## 📜 License

MIT
