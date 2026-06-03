# 🌐 ISO-19650 Automated Sheet Transmittal & Webhook Integration Pipeline
### *Continuous VDC Ecosystem & Resilient Validation Engine for Enterprise BIM Operations*

This repository houses a high-fidelity, production-grade **ISO-19650 Automated Sheet Transmittal Dashboard** coupled with a **Real-Time Webhook Broker Gateway** and a **Fail-Safe Workstation Resiliency Engine**. It is designed to bridge the gap between heavy desktop CAD tools (such as Revit, Dynamo, Grasshopper) and agile, lightweight client-facing browsers, resolving critical industry latency, accessibility, and fragility bottlenecks.

---

## 🏗️ System Architecture Diagram

```
+-------------------------------------------------+
|   DESKTOP CAD WORKSTATIONS (Dynamo/Grasshopper) |
+-------------------------------------------------+
       |
       |  POST [JSON drawing array payload]
       |  Authenticate: Bearer tok_bim_XXXX
       v
+-------------------------------------------------+
|       WEBHOOK BROADCAST GATEWAY (Express API)   | <---+ [Simulated Workstation Crashes]
|       Port 3000 /api/sheets/webhook             |
+-------------------------------------------------+
       |
       +---> [IF ONLINE] ---> Invoke server-side parser (Gemini API / ISO rules)
       |
       +---> [IF OFFLINE / LATENT] ---> Redirect flow to Safeguard Resiliency Vault
       v
+-------------------------------------------------+
|       SAFEGUARD RESILIENCY VAULT                  |
|       - High-fidelity cached local archive      |
|       - Preventing UI thread lock or page crashes|
+-------------------------------------------------+
       |
       |  WebSocket/HTTP Response Stream
       v
+-------------------------------------------------+
|       LIGHTWEIGHT FRONTEND CLIENT (React/Vite)  |
|       - Real-time Connection Health Indicators   |
|       - Staging Queue, Presets, Overrides       |
|       - Standardized CSV Transmittal Exporter   |
+-------------------------------------------------+
```

---

## 🛡️ The Fail-Safe / Resiliency Engine

Global Virtual Design & Construction (VDC) workflows are notoriously fragile. A CAD designer's local workstation crashing, an unstable office VPN dropping during a telemetry broadcast, or unformatted data flowing through an unstable dynamo script can easily ruin static dashboards. 

Our client implements **four distinctive connection & processing resiliency simulation levels** to prove extreme system robustness:

1. **Core Stable (Healthy)**: High-resolution direct parsing using server-side endpoints configured with full Gemini AI parsing or high-efficiency ISO heuristic fallbacks.
2. **Latency Drop Mode**: Simulates network brownouts or highly latent workstation responses. After a `1.5` second timeout threshold, the gateway intercepts the thread, displaying a **Safeguard Mode Banner** with a graceful cache injection to keep browser performance seamless.
3. **Revit Crash Mode (Offline)**: Simulates local workstation disconnects or severe application errors. The system immediately rolls back to display the **Last Verified Archive** and alerts the VDC controller with standard logs.
4. **Bad Stream Mode (Corrupted)**: Rejects dirty drawing names, mismatched JSON syntax, or negative sequence payloads to prevent dirty databases from polluting public transmittal logs.

---

## 📊 Developer API & JSON Data Schema Specifications

### 1. The Standardizer Endpoint (`/api/sheets/parse`)
Translates unformatted strings into strict ISO-19650 compliant filenames.

* **Method**: `POST`
* **Content-Type**: `application/json`
* **Request Payload**:
```json
{
  "rawLines": [
    "A-101_Level_1_Floor_Plan_Final_Draft.dwg",
    "S-301_FOUNDATION_CONCRETE_FOOTINGS_S.dwg"
  ],
  "options": {
    "prefix": "OLY",
    "delimiter": "-",
    "seqPadding": 3
  }
}
```

* **Successful Response** (`200 OK`):
```json
{
  "sheets": [
    {
      "id": "sheet_gem_16850020_0_abcde",
      "originalName": "A-101_Level_1_Floor_Plan_Final_Draft.dwg",
      "formattedCode": "OLY-ARC-LVL01-DWG-101",
      "title": "Level 1 Floor Plan",
      "discipline": "ARC",
      "zone": "LVL01",
      "docType": "DWG",
      "seqNumber": "101",
      "status": "valid",
      "validationMessage": "Standardized matching ISO-19650 standard specifications."
    },
    {
      "id": "sheet_gem_16850020_1_fghij",
      "originalName": "S-301_FOUNDATION_CONCRETE_FOOTINGS_S.dwg",
      "formattedCode": "OLY-STR-LVL01-DWG-301",
      "title": "Foundation Concrete Footings",
      "discipline": "STR",
      "zone": "LVL01",
      "docType": "DWG",
      "seqNumber": "301",
      "status": "valid",
      "validationMessage": "Standardized matching ISO-19650 standard specifications."
    }
  ]
}
```

---

### 2. The Remote Webhook API Endpoint (`/api/sheets/webhook`)
Ingests automated output schedules pushed outbound by Dynamo on-run-complete nodes. 

* **Method**: `POST`
* **Content-Type**: `application/json`
* **Request Payload**:
```json
{
  "token": "tok_bim_K3Y8F90N",
  "source": "Revit-Dynamo 5D Pipeline",
  "drawings": [
    "DYN-HVAC_Zone4_UnderflowPressure_Layout_R2.dwg",
    "DYN-STRUCT-L02-ReinforcementColumnGirders_signed.pdf"
  ]
}
```

* **Successful Response** (`200 OK`):
```json
{
  "success": true,
  "broker": "BIM-Automation-Broker-Cloud",
  "receivedCount": 2,
  "sourcePipeline": "Revit-Dynamo 5D Pipeline",
  "timestamp": "2026-06-02T20:21:53Z",
  "sheets": [
    {
      "id": "sheet_heur_16850123_0_xyz12",
      "originalName": "DYN-HVAC_Zone4_UnderflowPressure_Layout_R2.dwg",
      "formattedCode": "OLY-MEP-LVL01-DWG-100",
      "title": "Hvac Zone4 UnderflowPressure Layout",
      "discipline": "MEP",
      "zone": "LVL01",
      "docType": "DWG",
      "seqNumber": "100",
      "status": "warning",
      "validationMessage": "No explicit sequence matched; automatically assigned index."
    }
  ]
}
```

---

## ⚡ Key Features at an Enterprise Glance

* **Multi-Site portfolio Workspace Navigator**: Hot-swaps drawing coordinates, clashes lists, and takeoff schedules immediately across isolated projects.
* **AEC Industry Alignment**: Standardized fully on BS-1192 and BSA ISO-19650 protocols.
* **One-Click Local Backups**: Exports instantly to clean Excel comma-separated values (CSV) with automated transmittal logs.
* **Active Stream Command Console**: Emulates continuous logs mimicking developer server feedback queues.
* **Inline Dynamic Overrides**: Allows BIM Managers to manually edit descriptions directly on the sheet datatable if specific bypass requirements emerge.

---

## 🗃️ DB Schema Specifications & JSON Models

To enable seamless external integrations (such as pushing coordination data from Autodesk Construction Cloud, BIMcollab, or custom Python scripts), the gateway implements the following standardized Firestore and client data layouts:

### 1. BIM Workspace Project Document
A representation of a connected building project or infrastructure site.
```json
{
  "id": "demo_olympic_complex",
  "name": "Olympic Transit Hub Terminal 2",
  "location": "Paris, France",
  "status": "active",
  "ownerId": "usr_9J8F3K",
  "coordinates": "48.8566° N, 2.3522° E",
  "area": "45,200 m²",
  "revision": "RVT-T2-v4.5",
  "createdAt": "2026-06-02T20:21:53Z",
  "updatedAt": "2026-06-02T20:23:10Z"
}
```

### 2. 3D Coordination Clash Model
Stores structural, architectural, or MEP overlap events detected by the automated clash check engine.
```json
{
  "id": "clash_09aF8h1X",
  "projectId": "demo_olympic_complex",
  "elementId1": "385102",
  "elementId2": "495120",
  "discipline1": "STR",
  "discipline2": "MEP",
  "severity": "high",
  "status": "open",
  "coordinateX": 12.45,
  "coordinateY": -8.92,
  "coordinateZ": 4.15,
  "assignedTo": "Sarah Jenkins (MEP Lead)",
  "aiRecommendation": "Shift sprinkler pipeline up by +0.15m to bypass structural web girder steel plates.",
  "createdAt": "2026-06-02T20:25:00Z",
  "updatedAt": "2026-06-02T20:25:00Z"
}
```

### 3. Takeoff Scheduled BOQ Material Quantities
Quantified raw takeoff material records used for 5D financial estimations and schedule analysis.
```json
{
  "id": "boq_17bK9m2Y",
  "projectId": "demo_olympic_complex",
  "itemName": "Structural Steel Core Column W14x90",
  "category": "Steel Columns",
  "quantity": 42.0,
  "unit": "tons",
  "unitPrice": 1250.0,
  "totalPrice": 52500.0,
  "createdAt": "2026-06-02T20:26:15Z",
  "updatedAt": "2026-06-02T20:26:15Z"
}
```

### 4. BIM Collaboration Format (BCF) Issue
A standardized BCF issue container enabling multi-platform engineering coordination notes transmission.
```json
{
  "id": "bcf_82fL0q4R",
  "projectId": "demo_olympic_complex",
  "title": "Main Core HVAC Return Interference",
  "description": "The main return air duct conflicts directly with concrete lift shaft walls on Level 3.",
  "type": "Clash",
  "priority": "Critical",
  "assignedTo": "Sarah Jenkins (MEP Lead)",
  "status": "Open",
  "synced": true,
  "createdAt": "2026-06-02T20:28:00Z"
}
```
