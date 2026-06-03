# construction-coordination Firestore Security Specification

This document details the data invariants, adversarial attack vectors (The Dirty Dozen Payloads), and test strategies designed to secure our Construction BIM and BOQ visualizer database.

## 1. Data Invariants
- **Access Derived from Projects**: All sub-resources (Clashes and BOQ items) are owned by a parent `Project`.
- **Identity Invariance**: A user can only create projects where `ownerId` matches their authenticated UID.
- **System Integrity**: Clashes have coordinate sizes constrained within physical boundaries, and negative or zero coordinates are sanitized.
- **BOQ Monetary Integrity**: `totalPrice` must matches `quantity * unitPrice`, and neither can be negative.
- **Temporal Invariants**: `createdAt` on creation must match `request.time`. `updatedAt` on update must match `request.time`.

## 2. The "Dirty Dozen" Payloads (Adversarial Attack Cases)
Here are twelve designed payloads demonstrating logic-leak attempts that must be blocked securely by our `firestore.rules`.

### Attack 1: Self-Registered Admin Privilege Escalation
An attacker tries to create a custom user document or claim admin status artificially.
```json
// Path: /admins/unauthorized_user_uid
{
  "email": "attacker@spam.com",
  "isAdmin": true
}
```

### Attack 2: Project Owner Spoofing
A logged-in user tries to create a project with another user's UID as the owner.
```json
// Path: /projects/poisoned_project_1
{
  "id": "poisoned_project_1",
  "name": "Stolen SkyRise Project",
  "location": "Jakarta, ID",
  "status": "active",
  "ownerId": "victim_uid",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Attack 3: Shadow Coordinate Flooding (DDoS via high size values)
An attacker injects an enormously long text string or a massive float coordinate list to exhaust memory/storage or break visual rendering boundaries.
```json
// Path: /projects/project_1/clashes/clash_poison
{
  "id": "clash_poison",
  "projectId": "project_1",
  "title": "A".repeat(5000), // Enormous title string
  "status": "open",
  "severity": "high",
  "discipline1": "HVAC",
  "discipline2": "Structural",
  "coordinateX": 999999999.9,
  "coordinateY": -999999999.9,
  "coordinateZ": 123456789.0,
  "assignedTo": "Someone",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Attack 4: Spoofing Creation Timestamps
An attacker bypasses `request.time` by submitting a fake hardcoded static date in the past.
```json
// Path: /projects/project_1/clashes/clash_1
{
  "id": "clash_1",
  "projectId": "project_1",
  "title": "Clash HVAC",
  "status": "open",
  "severity": "high",
  "discipline1": "HVAC",
  "discipline2": "Structural",
  "coordinateX": 10,
  "coordinateY": 12,
  "coordinateZ": 1.5,
  "assignedTo": "John Doe",
  "createdAt": "2020-01-01T00:00:00Z", // Fake creation time
  "updatedAt": "2020-01-01T00:00:00Z"
}
```

### Attack 5: Negative Quantities BOQ
An attacker tries to construct a fraudulent takeoff with a negative quantity to credit/embezzle values.
```json
// Path: /projects/project_1/boqItems/boq_fraud_1
{
  "id": "boq_fraud_1",
  "projectId": "project_1",
  "category": "Structural Concrete",
  "elementType": "Foundation Pier",
  "quantity": -550.5, // Negative quantity
  "unit": "m3",
  "unitPrice": 125.0,
  "totalPrice": -68812.5,
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Attack 6: Modifying Project Owner (Immortality Violation)
An attacker attempts to lock an owner out of their own project by updating the project's ownership UID field.
```json
// Action: Update
{
  "ownerId": "attacker_uid"
}
```

### Attack 7: Status Shortcutting (Transition Bypass)
An attacker tries to mark a clash as "resolved" without checking or changing corresponding verification metadata fields.
```json
// Action: Bypass verification workflow
{
  "status": "resolved",
  "aiRecommendation": "System bypassed artificially"
}
```

### Attack 8: PII Blanket Read (Data Scraping)
An attacker tries to list projects owned by other users using a blanket query without ownerId filtering.
```json
// Query: projects where status == 'active' (excluding ownerId)
// Expectation: permission_denied due to missing ownerId constraint check.
```

### Attack 9: Incoherent Calculations Injection
An attacker submits a takeoff record where the total price does not match standard quantity * unit price rules.
```json
// Path: /projects/project_1/boqItems/boq_bad_calc
{
  "id": "boq_bad_calc",
  "projectId": "project_1",
  "category": "Drywall",
  "elementType": "Partition Wall Type A",
  "quantity": 100,
  "unit": "m2",
  "unitPrice": 15,
  "totalPrice": 1.0, // Fraudulent computation
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP"
}
```

### Attack 10: Injecting Extraneous fields (Ghost Fields)
An attacker submits fields not matching Firestore entity definitions (schema dilution).
```json
// Path: /projects/project_1/clashes/clash_ghost
{
  "id": "clash_ghost",
  "projectId": "project_1",
  "title": "Clash",
  "status": "open",
  "severity": "high",
  "discipline1": "HVAC",
  "discipline2": "Electrical",
  "coordinateX": 3,
  "coordinateY": 5,
  "coordinateZ": 10,
  "assignedTo": "Jerry",
  "createdAt": "SERVER_TIMESTAMP",
  "updatedAt": "SERVER_TIMESTAMP",
  "ghostFieldIsWinner": true, // Extraneous field
  "hackedCredentialToken": "112233"
}
```

### Attack 11: Modifying Immutable `createdAt`
An attacker attempts to write back data altering `createdAt` on an existing item update stream.
```json
// Update Project:
{
  "createdAt": "2021-12-25T11:00:00Z",
  "name": "Modified Project Name"
}
```

### Attack 12: Anonymous Write Escalation
An unauthenticated or unverified account attempts to instantiate records in the production database.
```json
// Write on authenticated collection:
// Expected: permission_denied due to request.auth == null
```

## 3. Test Runner
Below is a conceptual validation structure showing that each of these adversarial paths throws standard Firebase security errors (`PERMISSION_DENIED`).
All client requests must be securely scoped down.
