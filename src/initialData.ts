import { ClashStatus, ClashSeverity } from './types';

export interface BIMElementGeometry {
  id: string;
  name: string;
  discipline: 'Structural' | 'HVAC' | 'Plumbing' | 'Electrical' | 'Architectural';
  type: string;
  points: [number, number, number][]; // 3D path coordinates
  color: string;
  thickness: number;
}

export const SEEDED_CLASHES = [
  {
    title: "HVAC Duct vs Structural Concrete Beam clash",
    discipline1: "HVAC",
    discipline2: "Structural",
    severity: ClashSeverity.HIGH,
    status: ClashStatus.OPEN,
    coordinateX: 12.4,
    coordinateY: 8.5,
    coordinateZ: 3.2,
    assignedTo: "Sarah Jenkins (MEP Lead)"
  },
  {
    title: "Plumbing Main Soil Pipe vs Cabinets Cable Tray bypass",
    discipline1: "Plumbing",
    discipline2: "Electrical",
    severity: ClashSeverity.MEDIUM,
    status: ClashStatus.IN_REVIEW,
    coordinateX: 6.8,
    coordinateY: 14.2,
    coordinateZ: 2.8,
    assignedTo: "David Kim (Electrical Lead)"
  },
  {
    title: "Gravity HVAC Duct intersecting Column Core",
    discipline1: "HVAC",
    discipline2: "Structural",
    severity: ClashSeverity.CRITICAL,
    status: ClashStatus.OPEN,
    coordinateX: 18.1,
    coordinateY: 5.4,
    coordinateZ: 3.5,
    assignedTo: "Angela Davis (BIM Coordinator)"
  },
  {
    title: "Sprinkler pipe overlapping Architectural Exit Sign",
    discipline1: "Plumbing",
    discipline2: "Architectural",
    severity: ClashSeverity.LOW,
    status: ClashStatus.RESOLVED,
    coordinateX: 24.5,
    coordinateY: 11.2,
    coordinateZ: 2.4,
    assignedTo: "Marcus Brody (Site Engineer)"
  }
];

export const SEEDED_BOQ = [
  {
    category: "Structural Concrete",
    elementType: "High-Strength C35/45 Concrete Foundation Footings",
    quantity: 145.2,
    unit: "m3",
    unitPrice: 165.00,
    sourceLocation: "Substructure Phase 1 - Grid A1-D4",
    notes: "Requires plasticizer admixture for delayed set time due to summer heat.",
    carbonIntensity: 240, // kg CO2e per m3
    materialGrade: "Standard Portland Cement (OPC)"
  },
  {
    category: "Structural Steel",
    elementType: "BIM-H-Section Structural Steel Beams (300G)",
    quantity: 28.4,
    unit: "m",
    unitPrice: 94.50,
    sourceLocation: "Level 1 Deck Support Structural Grid",
    notes: "Sourced locally to optimize transportation carbon footprint. Lead time 14 days.",
    carbonIntensity: 115, // kg CO2e per m
    materialGrade: "Standard Hot-Rolled A36 Carbon Steel"
  },
  {
    category: "HVAC Ductwork",
    elementType: "Galvanized Sheet Steel HVAC Air Duct 600x400mm",
    quantity: 112.0,
    unit: "m",
    unitPrice: 42.00,
    sourceLocation: "Level 3 Ventilation Supply Loop",
    notes: "Requires acoustic lining on terminal 15 meters.",
    carbonIntensity: 14, // kg CO2e per m
    materialGrade: "Galvanized Sheet Steel Standard Profile"
  },
  {
    category: "Electrical Cabling",
    elementType: "Low-Smoke Zero-Halogen XLPE Cooper Feeder Cable 4-Core 95mm2",
    quantity: 240.0,
    unit: "m",
    unitPrice: 38.50,
    sourceLocation: "Main Switch Room to Level 2 Distribution Board",
    notes: "Run inside fire-rated PVC conduit.",
    carbonIntensity: 8.5, // kg CO2e per m
    materialGrade: "99% Recycled High-Conductivity Copper Wire"
  },
  {
    category: "Glazing & Curtain Walls",
    elementType: "Double-Glazed Low-E Thermal Curtain Wall Panels (1200x2400)",
    quantity: 74.0,
    unit: "pcs",
    unitPrice: 385.00,
    sourceLocation: "Exterior Facade North-East Section",
    notes: "U-Value certified. Delivered on structural pallets.",
    carbonIntensity: 45, // kg CO2e per pcs
    materialGrade: "Low-E Double Insulation Tempered Coating"
  }
];

// Let's model a beautiful physical layout of a building floor to render in our SVG coordinates!
// These points will represent structural walls, mechanical pipe routes, plumbing tracks, and we can visualize them in 2D or Isometric projection!
export const MOCK_BIM_GEOMETRIES: BIMElementGeometry[] = [
  // Outer perimeter Walls (Structural - Grey)
  {
    id: "wall-outer",
    name: "Outer Concrete Shear Wall",
    discipline: "Structural",
    type: "Wall",
    points: [[2, 2, 0], [28, 2, 0], [28, 18, 0], [2, 18, 0], [2, 2, 0]],
    color: "#64748B",
    thickness: 8
  },
  // Core lift shaft Walls (Structural)
  {
    id: "wall-core-lift",
    name: "Core Lift Shaft Shear Wall",
    discipline: "Structural",
    type: "Wall",
    points: [[13, 7, 0], [17, 7, 0], [17, 11, 0], [13, 11, 0], [13, 7, 0]],
    color: "#475569",
    thickness: 6
  },
  // Main air supply loop (HVAC - Green)
  {
    id: "hvac-main",
    name: "Main High Pressure Supply Duct",
    discipline: "HVAC",
    type: "Duct",
    points: [[4, 4, 3.2], [26, 4, 3.2], [26, 16, 3.2], [4, 16, 3.2], [4, 4, 3.2]],
    color: "#10B981",
    thickness: 4
  },
  // Secondary plumbing loop (Plumbing - Blue)
  {
    id: "plumb-main",
    name: "Domestic Cold Water Drainage Loop",
    discipline: "Plumbing",
    type: "Pipe",
    points: [[5, 14, 2.8], [15, 14, 2.8], [15, 15, 2.8], [25, 15, 2.8]],
    color: "#3B82F6",
    thickness: 2
  },
  // Main Electrical cable tray (Electrical - Yellow)
  {
    id: "elec-tray",
    name: "Data & Feeder Cable Tray",
    discipline: "Electrical",
    type: "Tray",
    points: [[8, 3, 2.9], [8, 15, 2.9], [19, 15, 2.9], [19, 5, 2.9]],
    color: "#EAB308",
    thickness: 2.5
  },
  // Office Dividers (Architectural - Cyan)
  {
    id: "arch-wall-1",
    name: "Acoustic Partition Wall",
    discipline: "Architectural",
    type: "Partition",
    points: [[10, 2, 0], [10, 7, 0]],
    color: "#06B6D4",
    thickness: 3
  },
  {
    id: "arch-wall-2",
    name: "Meeting Room Glazed Partition",
    discipline: "Architectural",
    type: "Partition",
    points: [[20, 11, 0], [20, 18, 0]],
    color: "#06B6D4",
    thickness: 3
  }
];

export const FLOOR_LEVEL_MAX_ELEVATIONS = [
  { level: "Foundation", elevation: -2.5, color: "#1E293B" },
  { level: "Ground Floor", elevation: 0.0, color: "#0F172A" },
  { level: "Level 1 Deck", elevation: 3.5, color: "#3B82F6" },
  { level: "Level 2 Deck", elevation: 7.0, color: "#10B981" },
  { level: "Roof Deck", elevation: 10.5, color: "#E11D48" }
];
