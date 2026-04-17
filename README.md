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

### 1. Advanced Interactive Heatmap
Visualise environmental risks across different floors with intelligent modeling.
-   **Deterministic Mode**: Displays the absolute worst status (Pass/Fail/Pending) for each location.
-   **Continuous Mode**: Calculates a "Risk Score" based on failure frequency and recency.
-   **Early Warning (SPC)**: Automatically flags locations with a **WARNING (Orange)** state if the last 3 quantitative swabs show a strictly rising trend, enabling proactive remediation before a breach occurs.
-   **Spatial Correlation ("Blast Radius")**: Failed markers render a visual "risk halo" to guide sanitation teams on vector swabbing in the immediate physical vicinity.

### 2. Historical Playback & Time-Travel
Step back in time to understand contamination events.
-   **Scrub History**: Use the timeline slider to view the facility status on any specific day in the past.
-   **Animated Time-Lapse**: Hit the **Play** button next to the slider to watch an animated replay of environmental trends over the last 90+ days.

### 3. Precision Filtering & Decay Tuning
Calibrate the risk model to specific pathogens.
-   **MIC filtering**: Multi-select characteristic types (e.g., Listeria, Salmonella, ATP) to isolate specific risks.
-   **Dynamic Decay**: The risk score automatically applies organism-specific half-lives (e.g., Listeria persists longer than generic ATP counts).
-   **Sensitivity Slider**: Manually tune the global risk sensitivity in real-time.

### 4. Location Intelligence & Reporting
-   **Trends**: Visualise MIC results over time with interactive SVG charts.
-   **Inspection Lots**: Detailed list of recent inspections with expandable result tables.
-   **Export to CSV**: Download heatmap marker data directly from the UI for offline reporting and compliance audits.

### 5. Admin Mode (Coordinate Mapping)
A dedicated tool for mapping SAP Functional Locations to X/Y floor plan coordinates.
-   **Hierarchy Engine**: Backend-driven cascading filters (L1 → L5) for efficient mapping.
-   **Drag-and-Drop**: Set or reposition markers by dragging locations directly onto the map.

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

## 🏗 Architecture Highlights

### SPC & Early Warning Logic
The backend applies a lightweight Statistical Process Control (SPC) rule: if a location has 3 consecutive quantitative results where $v_3 > v_2 > v_1$, it is flagged as `WARNING`. If the value is also $> 50\%$ of the upper tolerance, the warning is intensified.

### Risk Decay Algorithm
The risk score $S$ is calculated as:
$$S = \sum F_i \cdot e^{-\lambda t_i}$$
Where $F_i$ is the failure weight, $t_i$ is the days since the inspection, and $\lambda$ is the organism-specific decay constant. This ensures recent failures carry more weight than historical ones.

### Multi-Plant Generalization
The app is fully configurable via environment variables:
-   `EM_PLANT_ID`: Scope data to a specific plant.
-   `EM_FLOOR_CONFIG`: JSON string defining custom floors, SVG URLs, and dimensions.
-   `EM_LOT_TABLE`, `EM_RESULT_TABLE`, etc.: Dynamic Unity Catalog table paths.

---

## 🎨 Design & Accessibility
-   **IBM Carbon Design System**: Zero tolerance for hardcoded literals; full tokenisation.
-   **Dark Mode**: Supports a high-contrast `g100` theme for control room environments.
-   **Responsive & Mobile-Ready**: Collapsible side panels and wrapping filter bars ensure usability on tablets and mobile devices.
-   **Stability**: Global Error Boundaries prevent UI crashes and provide graceful recovery.
