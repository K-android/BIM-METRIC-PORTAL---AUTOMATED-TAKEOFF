export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface Project {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
  coordinates?: string;
  area?: string;
  revision?: string;
}

export enum ClashStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  RESOLVED = 'resolved',
  IGNORED = 'ignored'
}

export enum ClashSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Clash {
  id: string;
  projectId: string;
  title: string;
  status: ClashStatus;
  severity: ClashSeverity;
  discipline1: string;
  discipline2: string;
  coordinateX: number; // meters
  coordinateY: number; // meters
  coordinateZ: number; // meters
  assignedTo: string;
  aiRecommendation: string;
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

export interface BOQItem {
  id: string;
  projectId: string;
  category: string; // e.g. Concrete, Steel, HVAC, Masonry
  elementType: string;
  quantity: number;
  unit: string; // e.g. m3, m2, meters, pcs;
  unitPrice: number;
  totalPrice: number;
  sourceLocation: string; // e.g. Level 2, Grid C-4
  notes: string;
  carbonIntensity?: number; // kg CO2e emissions per unit
  totalCarbon?: number;     // kg CO2e emissions total
  materialGrade?: string;   // e.g. Standard Portland, 50% slag flyash, Recycled Structural Steel
  createdAt: any; // Firestore Timestamp;
  updatedAt: any; // Firestore Timestamp;
}

export interface Annotation {
  id: string;
  projectId: string;
  text: string;
  author: string;
  authorColor: string;
  coordinateX: number;
  coordinateY: number;
  coordinateZ: number;
  createdAt: any;
}

export interface UserPresence {
  id: string;
  projectId: string;
  name: string;
  color: string;
  cursorX: number;
  cursorY: number;
  viewMode: string;
  updatedAt: any;
}

export interface BCFIssue {
  id: string;
  projectId: string;
  guid: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  creationDate: string;
  creationAuthor: string;
  assignedTo: string;
  coordinateX: number;
  coordinateY: number;
  coordinateZ: number;
  discipline1: string;
  discipline2: string;
  comment: string;
  synced: boolean;
  syncedClashId?: string;
  createdAt: any;
}

export interface BIMDocument {
  id: string;
  projectId: string;
  originalName: string;
  formattedCode: string;
  title: string;
  discipline: string;
  zone: string;
  docType: string;
  seqNumber: string;
  status: 'valid' | 'warning' | 'invalid';
  validationMessage: string;
  createdAt: any;
}

