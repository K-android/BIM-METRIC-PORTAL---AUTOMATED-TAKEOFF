import { BIMElementGeometry } from '../initialData';

export interface SpatialParameters {
  length: number;       // linear meters
  thickness: number;    // cross-section thickness in cm
  calculatedArea: number; // m2
  calculatedVolume: number; // m3
  unit: string;
  quantity: number;
}

export interface MaterialSpecification {
  gradeName: string;
  unitPrice: number;    // USD per unit
  carbonIntensity: number; // kg CO2e per unit
  isEcoGrade: boolean;
  notes: string;
}

// 1. Custom Spatial Parameter Extraction Logic:
// Calculates Euclidean Euclidean distance between 3D joints/coordinates
export function calculateGeometryLength(points: [number, number, number][]): number {
  if (points.length < 2) return 0;
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1, z1] = points[i];
    const [x2, y2, z2] = points[i + 1];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    totalLength += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return Number(totalLength.toFixed(1));
}

export function extractSpatialParameters(element: BIMElementGeometry): SpatialParameters {
  const length = calculateGeometryLength(element.points);
  const thicknessCm = element.thickness * 5; // scaled to real-world cm
  const thicknessM = thicknessCm / 100;

  let calculatedArea = 0;
  let calculatedVolume = 0;
  let unit = 'm';
  let quantity = length;

  // Custom engineering translation equations depending on structural classification:
  if (element.type === 'Wall') {
    // Wall height assumed 3.2m
    const height = 3.2;
    calculatedArea = Number((length * height).toFixed(1));
    calculatedVolume = Number((length * thicknessM * height).toFixed(1));
    unit = 'm3';
    quantity = calculatedVolume;
  } else if (element.type === 'Duct' || element.type === 'Pipe') {
    // Cross sectional radius
    const radius = thicknessM / 2;
    calculatedVolume = Number((Math.PI * radius * radius * length).toFixed(2));
    calculatedArea = Number((2 * Math.PI * radius * length).toFixed(1));
    unit = 'm';
    quantity = length;
  } else if (element.type === 'Partition') {
    const height = 2.8;
    calculatedArea = Number((length * height).toFixed(1));
    calculatedVolume = Number((length * thicknessM * height).toFixed(2));
    unit = 'm2';
    quantity = calculatedArea;
  } else {
    // Default fallback
    calculatedArea = Number((length * thicknessM).toFixed(1));
    calculatedVolume = Number((length * thicknessM * thicknessM).toFixed(2));
    unit = 'm';
    quantity = length;
  }

  return {
    length,
    thickness: thicknessCm,
    calculatedArea,
    calculatedVolume,
    unit,
    quantity
  };
}

// 2. Semantic Material Lexicon Map (Standard vs Green Eco-alternatives)
export const MATERIAL_SPECS: Record<string, MaterialSpecification[]> = {
  Structural: [
    {
      gradeName: "Standard Portland Concrete (OPC Grade C40)",
      unitPrice: 165.00,
      carbonIntensity: 240, // kg CO2e per m3
      isEcoGrade: false,
      notes: "Standard fast-curing heavy carbon-intensity structure."
    },
    {
      gradeName: "Eco-Conscious Green Slag Concrete (40% GGBS)",
      unitPrice: 180.00,
      carbonIntensity: 130, // 45% embodied carbon reduction!
      isEcoGrade: true,
      notes: "High sustainable index. Slower curing but double durability."
    },
    {
      gradeName: "Standard Structural A36 Carbon Steel Beams",
      unitPrice: 94.50,
      carbonIntensity: 115, // kg CO2e per m
      isEcoGrade: false,
      notes: "High strength, virgin steel fabrication."
    },
    {
      gradeName: "90% Recycled Electric-Arc Furnace Steel Profile",
      unitPrice: 105.00,
      carbonIntensity: 42, // 63% carbon reduction
      isEcoGrade: true,
      notes: "Recycled content certifies heavy credit indicators."
    }
  ],
  HVAC: [
    {
      gradeName: "Galvanized Sheet Steel (Standard Profile)",
      unitPrice: 42.00,
      carbonIntensity: 14.0, // kg CO2e per linear meter
      isEcoGrade: false,
      notes: "Standard anti-corrosive zinc coating."
    },
    {
      gradeName: "Eco-Acoustic Recycled Aluminum Ventilation Ducting",
      unitPrice: 49.50,
      carbonIntensity: 5.5, // low carbon
      isEcoGrade: true,
      notes: "Lightweight, high-recycled aluminum sheets."
    }
  ],
  Plumbing: [
    {
      gradeName: "Standard PVC Drainage Piping (Schedule 40)",
      unitPrice: 28.00,
      carbonIntensity: 6.8, // kg CO2e per m
      isEcoGrade: false,
      notes: "Standard synthetic chlorinated plastic pipe."
    },
    {
      gradeName: "Bio-Plastic PLA Plant-Derived Degradable Conduit",
      unitPrice: 34.00,
      carbonIntensity: 2.2, // 68% footprint savings
      isEcoGrade: true,
      notes: "Derived from plant starch feeds. 100% recyclable."
    }
  ],
  Electrical: [
    {
      gradeName: "Virgin Copper XLPE High Feeder Cable",
      unitPrice: 38.50,
      carbonIntensity: 8.5, // kg CO2e per m
      isEcoGrade: false,
      notes: "Virgin copper mine sourced."
    },
    {
      gradeName: "99% Recycled High-Conductivity Copper Wire",
      unitPrice: 41.00,
      carbonIntensity: 3.2, // 62% reduction
      isEcoGrade: true,
      notes: "Post-consumer wire refined electrically."
    }
  ],
  Architectural: [
    {
      gradeName: "Standard Gypsum Core Drywall Framing",
      unitPrice: 30.00,
      carbonIntensity: 10.2, // kg CO2e per m2
      isEcoGrade: false,
      notes: "Virgin gypsum partitions."
    },
    {
      gradeName: "FSC Certified Compressed Straw Acoustic Partition",
      unitPrice: 32.50,
      carbonIntensity: -4.5, // Net carbon negative (Biogenic sequestration!)
      isEcoGrade: true,
      notes: "Carbon sequestering strawboard. Captures atmosphere CO2."
    }
  ]
};

// Simple helper to get default lists depending on discipline classification
export function getMaterialGradesForDiscipline(discipline: string): MaterialSpecification[] {
  const key = discipline as keyof typeof MATERIAL_SPECS;
  return MATERIAL_SPECS[key] || MATERIAL_SPECS['Architectural'];
}
