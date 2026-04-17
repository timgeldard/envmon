# Environmental Monitoring (EM) Visualisation App

An enterprise-grade spatial visualisation tool for monitoring environmental inspection results. Built as a **Databricks App**, it provides a real-time (and historical) view of facility health using interactive floor plans and heatmaps.

## 🚀 Quickstart

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Databricks CLI** (configured with a profile for deployment)

### Local Development
The app can be run locally without a Databricks connection for UI/UX development. API requests will be proxied to the local backend.

1.  **Install dependencies**:
    ```bash
    make install
    ```

2.  **Start development servers**:
    ```bash
    make dev
    ```
    - Frontend: [http://localhost:5173](http://localhost:5173)
    - Backend API: [http://localhost:8000](http://localhost:8000)
    - Swagger Docs: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)

### Deployment
Use the `Makefile` to ensure a consistent build and migration process.

```bash
# Deploy to UAT (default)
make deploy PROFILE=uat

# Deploy to PROD
make deploy PROFILE=prod
```

---

## 🛠 Tech Stack

-   **Backend**: Python (FastAPI), Uvicorn, Databricks SQL SDK.
-   **Frontend**: React (TypeScript), Vite, IBM Carbon Design System v11, TanStack Query (React Query).
-   **Styling**: SCSS with Carbon Design Tokens.
-   **Infrastructure**: Databricks Apps, Databricks SQL Warehouse.

---

## ✨ Key Features

### 1. Interactive Heatmap
Visualise environmental risks across different floors.
-   **Deterministic Mode**: Displays the absolute worst status (Pass/Fail/Pending) for each location in the selected window.
-   **Continuous Mode**: Calculates a "Risk Score" based on historical failure frequency and recency, rendered with a visual "glow" effect.

### 2. Time-Travel Historical Scrubbing
Use the **Scrub History** slider to step back in time. The entire heatmap and location statuses will recalculate to show exactly how the facility looked on any specific day in the past year.

### 3. Location Intelligence
Click any marker to open the **Location Panel**:
-   **Trends**: Visualise MIC (Master Inspection Characteristic) results over time with interactive SVG charts.
-   **Inspection Lots**: A detailed list of recent inspections with expandable result tables.
-   **Responsive Design**: The panel can be expanded for deep-dive analysis.

### 4. Admin Mode (Coordinate Mapping)
A dedicated tool for facility administrators to map SAP Functional Locations to X/Y coordinates on the floor plans.
-   **Hierarchy Engine**: Backend-driven cascading filters (L1 → L5) to quickly find unmapped locations.
-   **Drag-and-Drop**: Simply drag a location from the sidebar onto the map to set its position.

---

## 📂 Project Structure

```text
├── backend/                # FastAPI application
│   ├── routers/            # API endpoints (Heatmap, Trends, Coordinates, etc.)
│   ├── schemas/            # Pydantic models (domain types)
│   └── utils/              # DB helpers and Databricks integration
├── frontend/               # React + Vite application
│   ├── src/
│   │   ├── api/            # React Query hooks
│   │   ├── components/     # UI Shell, FloorPlan, SidePanel, Admin tools
│   │   ├── context/        # Global state (Theme, Filters, Date)
│   │   └── index.scss      # Global styles & Carbon token overrides
├── scripts/
│   └── migrations/         # DDL scripts for Databricks SQL
├── Makefile                # Unified build/deploy/dev commands
├── app.template.yaml       # Template for Databricks App config
└── databricks.yml          # Databricks Asset Bundle config
```

---

## 🗄 Database & Migrations
The application stores its configuration (coordinates) in a dedicated table on Databricks SQL:
-   `em_location_coordinates`: Maps `func_loc_id` to `floor_id`, `x_pos`, and `y_pos`.

Migrations are idempotent and applied automatically during `make deploy`. They can be run manually via:
```bash
make setup-coordinates PROFILE=uat
```

---

## 🏗 Architecture Highlights

### Heatmap Logic
The heatmap supports two distinct visualisation strategies:
-   **Deterministic**: A binary-style view where any failure in the time window (clamped by the time-travel slider) results in a "Red" status.
-   **Continuous (Risk Score)**: A weighted calculation that considers both the frequency and recency of failures. A location that failed yesterday is "riskier" than one that failed 3 months ago.

### Backend Hierarchy Engine
To support the admin mapping tool without overloading the frontend, the backend constructs a nested dictionary of unmapped locations. It uses a recursive `setdefault` pattern to group locations into a 5-segment hierarchy (L1-L4 for filtering, L5 as the selectable item).

### Time-Travel Sync
The `FilterBar` uses a custom `computeDaysSinceToday` helper to synchronise the **Vite** frontend state with the **FastAPI** backend. When you move the slider, the `as_of_date` is sent to the backend, which adjusts its SQL `WHERE` clauses to "point-in-time" queries.

---

## 🎨 Design Standards
This project follows the **IBM Carbon Design System** with zero tolerance for hardcoded literals.
-   All spacing, colors, and typography use `var(--cds-*)` tokens.
-   Supports **Dark Mode** via the Carbon `g100` theme (toggle in the header).
-   Layout adheres to the **IBM UI Shell** architecture.
