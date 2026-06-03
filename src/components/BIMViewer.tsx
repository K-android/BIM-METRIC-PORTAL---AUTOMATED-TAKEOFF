import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MOCK_BIM_GEOMETRIES, SEEDED_CLASHES, BIMElementGeometry } from '../initialData';
import { Clash, ClashSeverity, ClashStatus, Annotation, UserPresence, BOQItem } from '../types';
import { 
  Layers, 
  Rotate3d, 
  Compass, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  CheckSquare, 
  Square, 
  Locate, 
  AlertTriangle, 
  Hammer, 
  Ruler,
  Users,
  MessageSquare,
  Pin,
  Trash2,
  Check,
  MapPin,
  Plus,
  HelpCircle,
  X,
  Sprout,
  Leaf,
  RefreshCw,
  CheckCircle2,
  RotateCw,
  RotateCcw
} from 'lucide-react';
import { 
  createAnnotation, 
  deleteAnnotation, 
  listenToAnnotations, 
  updateUserPresence, 
  listenToPresence, 
  removeUserPresence 
} from '../dbService';
import { 
  extractSpatialParameters, 
  getMaterialGradesForDiscipline, 
  SpatialParameters, 
  MaterialSpecification 
} from '../utils/takeoffHarvester';

interface BIMViewerProps {
  projectId: string;
  currentUser: any;
  clashes: Clash[];
  selectedClash: Clash | null;
  onSelectClash: (clash: Clash) => void;
  filteredDisciplines: string[];
  setFilteredDisciplines: React.Dispatch<React.SetStateAction<string[]>>;
  onAddBOQItem?: (item: Omit<BOQItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'totalPrice'>) => Promise<void>;
}

export default function BIMViewer({
  projectId,
  currentUser,
  clashes,
  selectedClash,
  onSelectClash,
  filteredDisciplines,
  setFilteredDisciplines,
  onAddBOQItem
}: BIMViewerProps) {
  // 1. Core viewer states
  const [viewMode, setViewMode] = useState<'2d' | 'iso'>('2d');
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isoAngle, setIsoAngle] = useState<number>(30);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [activeLevelFilter, setActiveLevelFilter] = useState<'all' | 'basement' | 'ground' | 'level1' | 'level2'>('all');
  
  // Property inspector state & 5D simulator state
  const [inspectedElement, setInspectedElement] = useState<BIMElementGeometry | null>(null);
  const [selectedMaterialGradeIndex, setSelectedMaterialGradeIndex] = useState<number>(0);
  const [isSyncingHarvest, setIsSyncingHarvest] = useState<boolean>(false);
  const [harvestSyncSuccess, setHarvestSyncSuccess] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'harvester' | 'multiplayer'>('harvester');

  // Reset simulator state when inspected element changes
  useEffect(() => {
    setSelectedMaterialGradeIndex(0);
    setIsSyncingHarvest(false);
    setHarvestSyncSuccess(false);
    if (inspectedElement) {
      setActiveSidebarTab('harvester');
    }
  }, [inspectedElement]);

  // 2. Collaborative Synchronization States
  const [collaborators, setCollaborators] = useState<UserPresence[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isAnnotationMode, setIsAnnotationMode] = useState(false);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    coordinateX: number;
    coordinateY: number;
    coordinateZ: number;
    text: string;
  } | null>(null);

  // 3. Simulated Peer Session Fallback
  // If no other active browser tabs are connected, we spawn simulated coworker cursors to demonstrate features immediately!
  const [syntheticPeers, setSyntheticPeers] = useState<UserPresence[]>([
    {
      id: 'mock_peer_1',
      projectId: projectId || 'demo',
      name: 'Esther (MEP Lead)',
      color: '#10B981',
      cursorX: 12.4,
      cursorY: 8.5,
      viewMode: '2d',
      updatedAt: new Date()
    },
    {
      id: 'mock_peer_2',
      projectId: projectId || 'demo',
      name: 'Marcus (Architect)',
      color: '#8B5CF6',
      cursorX: 18.2,
      cursorY: 14.1,
      viewMode: 'iso',
      updatedAt: new Date()
    }
  ]);

  // 4. Local User Profile setup
  const [myProfile, setMyProfile] = useState<{ name: string; color: string }>(() => {
    const savedName = localStorage.getItem('bim_collab_name');
    const savedColor = localStorage.getItem('bim_collab_color');
    
    const randomNicknames = [
      'Site Inspector', 'Structural Lead', 'MEP Coordinator',
      'HVAC Auditor', 'Surveying Lead', 'BIM Modeler'
    ];
    
    // Fallback to displayName or select randomized title
    const defaultName = savedName || currentUser?.displayName || randomNicknames[Math.floor(Math.random() * randomNicknames.length)];
    
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
    const defaultColor = savedColor || colors[Math.floor(Math.random() * colors.length)];
    
    return { name: defaultName, color: defaultColor };
  });

  // Client-level session tracker handle
  const sessionId = useMemo(() => {
    let sId = sessionStorage.getItem('bim_session_id');
    if (!sId) {
      sId = 'usr_' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('bim_session_id', sId);
    }
    return currentUser?.uid ? `${currentUser.uid}_${sId}` : `guest_${sId}`;
  }, [currentUser]);

  // Capture last database push to prevent overloading
  const lastPresenceWrite = useRef<number>(0);

  // Colors database palette
  const COLLAB_COLORS = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];

  // Load guest annotations on mount or when projectId/currentUser changes
  useEffect(() => {
    if (!currentUser) {
      const saved = localStorage.getItem(`bim_guest_annotations_${projectId}`);
      if (saved) {
        try {
          setAnnotations(JSON.parse(saved));
          return;
        } catch (e) {}
      }
      // Seed default sandbox annotation
      if (projectId === 'demo_olympic_complex') {
        const defaultAnns = [
          {
            id: 'demo_ann_1',
            projectId: 'demo_olympic_complex',
            text: 'Notice: HVAC main duct clashes with Structural Plate Girder. Needs resolution.',
            author: 'Esther (MEP Lead)',
            authorColor: '#10B981',
            coordinateX: 12.4,
            coordinateY: 8.5,
            coordinateZ: 2.0,
            createdAt: new Date().toISOString()
          }
        ];
        setAnnotations(defaultAnns);
        localStorage.setItem(`bim_guest_annotations_${projectId}`, JSON.stringify(defaultAnns));
      } else {
        setAnnotations([]);
      }
    }
  }, [projectId, currentUser]);

  // 5. Subscribe to Firestore synchronizers
  useEffect(() => {
    if (!projectId) return;

    if (!currentUser) {
      setCollaborators([]);
      return;
    }

    // Establish real-time live collaborators cursors
    const unsubscribePresence = listenToPresence(projectId, (list) => {
      // Filter out current active session instance
      setCollaborators(list.filter(item => item.id !== sessionId));
    }, (error) => {
      console.warn("Presence database reading bypass active (interactive sandbox state): ", error);
    });

    // Establish real-time visual dropped notes/annotations
    const unsubscribeAnnotations = listenToAnnotations(projectId, (list) => {
      setAnnotations(list);
    }, (error) => {
      console.warn("Annotations database reading bypass active (interactive sandbox state): ", error);
    });

    // Initialize presence document on mount
    updateUserPresence(projectId, sessionId, {
      projectId,
      name: myProfile.name,
      color: myProfile.color,
      cursorX: 15,
      cursorY: 10,
      viewMode: viewMode
    });

    return () => {
      unsubscribePresence();
      unsubscribeAnnotations();
      
      // Cleanup cursor presence on tab closure
      removeUserPresence(projectId, sessionId);
    };
  }, [projectId, sessionId, myProfile.name, myProfile.color, viewMode, currentUser]);

  // 6. Simulate coworker cursor paths beautifully using a trigonometric loop
  useEffect(() => {
    const interval = setInterval(() => {
      const time = Date.now() * 0.001;
      setSyntheticPeers(prev => prev.map((p, idx) => {
        // Different coordinate path formulas for Esther vs Marcus
        if (idx === 0) {
          return {
            ...p,
            cursorX: Number((13.5 + Math.sin(time * 0.7) * 4).toFixed(2)),
            cursorY: Number((9.0 + Math.cos(time * 0.5) * 3).toFixed(2)),
          };
        } else {
          return {
            ...p,
            cursorX: Number((16.0 + Math.cos(time * 0.9) * 5).toFixed(2)),
            cursorY: Number((11.5 + Math.sin(time * 0.6) * 4).toFixed(2)),
          };
        }
      }));
    }, 150);

    return () => clearInterval(interval);
  }, []);

  // Update name in state & persist in cooking local details
  const handleChangeProfileName = (newName: string) => {
    const name = newName.trim() ? newName : 'Anonymous';
    setMyProfile(prev => ({ ...prev, name }));
    localStorage.setItem('bim_collab_name', name);
  };

  const handleChangeProfileColor = (color: string) => {
    setMyProfile(prev => ({ ...prev, color }));
    localStorage.setItem('bim_collab_color', color);
  };

  // SVG dimensions
  const width = 600;
  const height = 400;

  // 7. Isometric mapping algorithms
  const projectPoint = (x: number, y: number, z: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const scaleFactor = 11 * zoom;
    
    const offsetModelX = x - 15;
    const offsetModelY = y - 10;

    if (viewMode === '2d') {
      const screenX = cx + offsetModelX * scaleFactor * 1.5 + pan.x;
      const screenY = cy + offsetModelY * scaleFactor * 1.5 + pan.y;
      return { x: screenX, y: screenY };
    } else {
      // Dynamic planar rotation of offset points centered around center of model space
      const customRotRad = ((isoAngle - 30) * Math.PI) / 180;
      const cosR = Math.cos(customRotRad);
      const sinR = Math.sin(customRotRad);
      
      const rotatedX = offsetModelX * cosR - offsetModelY * sinR;
      const rotatedY = offsetModelX * sinR + offsetModelY * cosR;

      const angle = Math.PI / 6; // 30 deg isometric tilt slant
      const isoX = (rotatedX - rotatedY) * Math.cos(angle);
      const isoY = (rotatedX + rotatedY) * Math.sin(angle) - (z * 1.5);
      
      const screenX = cx + isoX * scaleFactor * 1.5 + pan.x;
      const screenY = cy + isoY * scaleFactor * 1.5 + pan.y;
      return { x: screenX, y: screenY };
    }
  };

  const getPathData = (points: [number, number, number][]) => {
    if (points.length === 0) return '';
    let d = '';
    points.forEach((p, idx) => {
      const proj = projectPoint(p[0], p[1], p[2]);
      if (idx === 0) {
        d += `M ${proj.x} ${proj.y}`;
      } else {
        d += ` L ${proj.x} ${proj.y}`;
      }
    });
    return d;
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsoAngle(30);
    setInspectedElement(null);
  };

  const handleToggleDiscipline = (discipline: string) => {
    if (filteredDisciplines.includes(discipline)) {
      setFilteredDisciplines(filteredDisciplines.filter(d => d !== discipline));
    } else {
      setFilteredDisciplines([...filteredDisciplines, discipline]);
    }
  };

  // 8. Move handlers incorporating Live database position broadcasting
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    // If annotation mode is active, do not allow pan drag
    if (isAnnotationMode) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Translate relative mouse offsets to standard 3D model space:
    const cx = width / 2;
    const cy = height / 2;
    const scaleFactor = 11 * zoom;

    let modelX = 15;
    let modelY = 10;
    
    if (viewMode === '2d') {
      modelX = (clickX - cx - pan.x) / (scaleFactor * 1.5) + 15;
      modelY = (clickY - cy - pan.y) / (scaleFactor * 1.5) + 10;
    } else {
      const angle = Math.PI / 6;
      const isoX = (clickX - cx - pan.x) / (scaleFactor * 1.5);
      const isoY = (clickY - cy - pan.y) / (scaleFactor * 1.5);
      const cosVal = Math.cos(angle);
      const sinVal = Math.sin(angle);
      
      const adjIsoY = isoY + (2 * 1.5); // assumed avg Z = 2m height offsets
      const diff = isoX / cosVal;
      const sum = adjIsoY / sinVal;
      const rotX = (sum + diff) / 2;
      const rotY = (sum - diff) / 2;

      // Invert planar rotation:
      const customRotRad = ((isoAngle - 30) * Math.PI) / 180;
      const cosR = Math.cos(customRotRad);
      const sinR = Math.sin(customRotRad);
      
      modelX = rotX * cosR + rotY * sinR + 15;
      modelY = -rotX * sinR + rotY * cosR + 10;
    }

    modelX = Math.max(0, Math.min(30, Number(modelX.toFixed(2))));
    modelY = Math.max(0, Math.min(20, Number(modelY.toFixed(2))));

    // Track dragging pan offsets
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }

    // Throttled live broadcasting to firestore
    const now = Date.now();
    if (currentUser && now - lastPresenceWrite.current > 160) {
      lastPresenceWrite.current = now;
      updateUserPresence(projectId, sessionId, {
        projectId,
        name: myProfile.name,
        color: myProfile.color,
        cursorX: modelX,
        cursorY: modelY,
        viewMode: viewMode
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Click on SVG to dropped pins
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!isAnnotationMode) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const cx = width / 2;
    const cy = height / 2;
    const scaleFactor = 11 * zoom;

    let modelX = 15;
    let modelY = 10;
    
    if (viewMode === '2d') {
      modelX = (clickX - cx - pan.x) / (scaleFactor * 1.5) + 15;
      modelY = (clickY - cy - pan.y) / (scaleFactor * 1.5) + 10;
    } else {
      const angle = Math.PI / 6;
      const isoX = (clickX - cx - pan.x) / (scaleFactor * 1.5);
      const isoY = (clickY - cy - pan.y) / (scaleFactor * 1.5);
      const cosVal = Math.cos(angle);
      const sinVal = Math.sin(angle);
      
      const adjIsoY = isoY + (2 * 1.5);
      const diff = isoX / cosVal;
      const sum = adjIsoY / sinVal;
      const rotX = (sum + diff) / 2;
      const rotY = (sum - diff) / 2;

      // Invert planar rotation:
      const customRotRad = ((isoAngle - 30) * Math.PI) / 180;
      const cosR = Math.cos(customRotRad);
      const sinR = Math.sin(customRotRad);
      
      modelX = rotX * cosR + rotY * sinR + 15;
      modelY = -rotX * sinR + rotY * cosR + 10;
    }

    modelX = Math.max(0, Math.min(30, Number(modelX.toFixed(2))));
    modelY = Math.max(0, Math.min(20, Number(modelY.toFixed(2))));

    // Open prompt form popup inside viewer
    setPendingAnnotation({
      coordinateX: modelX,
      coordinateY: modelY,
      coordinateZ: 2.0, // default model height
      text: ''
    });
  };

  // Submit Annotation
  const handleSaveAnnotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAnnotation || !pendingAnnotation.text.trim()) return;

    const newAnn = {
      projectId,
      text: pendingAnnotation.text.trim(),
      author: myProfile.name,
      authorColor: myProfile.color,
      coordinateX: pendingAnnotation.coordinateX,
      coordinateY: pendingAnnotation.coordinateY,
      coordinateZ: pendingAnnotation.coordinateZ
    };

    if (currentUser) {
      // Save to Firestore
      await createAnnotation(projectId, newAnn);
    } else {
      // Save to local storage
      const localAnn: Annotation = {
        ...newAnn,
        id: `guest_ann_${Date.now()}`,
        createdAt: new Date()
      };
      setAnnotations(prev => {
        const next = [localAnn, ...prev];
        localStorage.setItem(`bim_guest_annotations_${projectId}`, JSON.stringify(next));
        return next;
      });
    }
    
    setPendingAnnotation(null);
    setIsAnnotationMode(false);
  };

  // Delete Annotation
  const handleDeleteAnnotationItem = async (annId: string) => {
    if (confirm("Delete this pinned collaborative observation note?")) {
      if (currentUser) {
        await deleteAnnotation(projectId, annId);
      } else {
        setAnnotations(prev => {
          const next = prev.filter(a => a.id !== annId);
          localStorage.setItem(`bim_guest_annotations_${projectId}`, JSON.stringify(next));
          return next;
        });
      }
    }
  };

  // Helper to isolate element floor levels
  const getElementLevel = (points: [number, number, number][]): 'basement' | 'ground' | 'level1' | 'level2' => {
    if (points.length === 0) return 'ground';
    // Calculate the average Z coordinate or min Z coordinate to resolve floor grouping cleanly
    const minZ = Math.min(...points.map(p => p[2]));
    if (minZ < 0) return 'basement';
    if (minZ === 0) return 'ground';
    if (minZ > 0 && minZ < 3.3) return 'level1';
    return 'level2';
  };

  // Helper to resolve generic point elevations by Z
  const getZLevel = (z: number): 'basement' | 'ground' | 'level1' | 'level2' => {
    if (z < 0) return 'basement';
    if (z === 0) return 'ground';
    if (z > 0 && z < 3.3) return 'level1';
    return 'level2';
  };

  // Dynamic drawings selection relative to selected active workspace
  const projectGeometries = useMemo(() => {
    if (projectId === 'demo_hudson_yards') {
      return [
        {
          id: "wall-outer-hy",
          name: "Hudson Yards Tower Perimeter",
          discipline: "Structural" as const,
          type: "Wall",
          points: [[4, 4, 0], [26, 4, 0], [26, 16, 0], [4, 16, 0], [4, 4, 0]] as [number, number, number][],
          color: "#475569",
          thickness: 10
        },
        {
          id: "hvac-main-hy",
          name: "High Velocity HVAC Duct Loop",
          discipline: "HVAC" as const,
          type: "Duct",
          points: [[6, 6, 4.2], [24, 6, 4.2], [24, 14, 4.2], [6, 14, 4.2], [6, 6, 4.2]] as [number, number, number][],
          color: "#10B981",
          thickness: 5
        },
        {
          id: "plumb-main-hy",
          name: "Vertical Stormwater Standpipe",
          discipline: "Plumbing" as const,
          type: "Pipe",
          points: [[8, 12, 1.2], [22, 12, 1.2]] as [number, number, number][],
          color: "#3B82F6",
          thickness: 3
        },
        {
          id: "elec-tray-hy",
          name: "HV Feeder Tray A",
          discipline: "Electrical" as const,
          type: "Tray",
          points: [[10, 5, 3.8], [10, 13, 3.8], [20, 13, 3.8]] as [number, number, number][],
          color: "#EAB308",
          thickness: 3
        },
        // Hudson Yards Basement Foundation Geometries (z = -2.5m)
        {
          id: "hy-retaining-wall",
          name: "Subgrade Heavy Concrete Retaining Wall",
          discipline: "Structural" as const,
          type: "Wall",
          points: [[3.5, 3.5, -2.5], [26.5, 3.5, -2.5], [26.5, 16.5, -2.5], [3.5, 16.5, -2.5], [3.5, 3.5, -2.5]] as [number, number, number][],
          color: "#334155",
          thickness: 12
        },
        {
          id: "hy-piling-1",
          name: "Bedrock Structural Pile Tie Column A",
          discipline: "Structural" as const,
          type: "Pile",
          points: [[6, 6, -2.5], [8, 8, -2.5]] as [number, number, number][],
          color: "#1E293B",
          thickness: 15
        },
        {
          id: "hy-piling-2",
          name: "Bedrock Structural Pile Tie Column B",
          discipline: "Structural" as const,
          type: "Pile",
          points: [[24, 6, -2.5], [22, 8, -2.5]] as [number, number, number][],
          color: "#1E293B",
          thickness: 15
        },
        {
          id: "hy-sump-pipe",
          name: "Subgrade High-Pressure Waste Sump Loop",
          discipline: "Plumbing" as const,
          type: "Pipe",
          points: [[7, 7, -2.5], [23, 7, -2.5], [23, 13, -2.5], [7, 13, -2.5]] as [number, number, number][],
          color: "#0284C7",
          thickness: 4
        }
      ];
    } else if (projectId === 'demo_marina_bay') {
      return [
        {
          id: "wall-outer-mbs",
          name: "Marina Curved Core Shear Wall",
          discipline: "Structural" as const,
          type: "Wall",
          points: [[2, 10, 0], [8, 4, 0], [15, 2, 0], [22, 4, 0], [28, 10, 0]] as [number, number, number][],
          color: "#1E293B",
          thickness: 12
        },
        {
          id: "hvac-main-mbs",
          name: "Main Curved Supply Duct",
          discipline: "HVAC" as const,
          type: "Duct",
          points: [[2, 12, 3.5], [15, 6, 3.5], [28, 12, 3.5]] as [number, number, number][],
          color: "#10B981",
          thickness: 4
        },
        {
          id: "plumb-mbs",
          name: "Main Water Chiller Pipe",
          discipline: "Plumbing" as const,
          type: "Pipe",
          points: [[4, 15, 2.5], [15, 10, 2.5], [26, 15, 2.5]] as [number, number, number][],
          color: "#2563EB",
          thickness: 3
        },
        // Marina Bay Sands Underwater Basement Geometries (z = -2.5m)
        {
          id: "mbs-marine-piling-1",
          name: "Sea Bed Structural Anchor Cap A",
          discipline: "Structural" as const,
          type: "Wall",
          points: [[3, 3, -2.5], [10, 3, -2.5]] as [number, number, number][],
          color: "#475569",
          thickness: 14
        },
        {
          id: "mbs-marine-piling-2",
          name: "Sea Bed Structural Anchor Cap B",
          discipline: "Structural" as const,
          type: "Wall",
          points: [[20, 17, -2.5], [27, 17, -2.5]] as [number, number, number][],
          color: "#475569",
          thickness: 14
        },
        {
          id: "mbs-seawater-intake",
          name: "Subgrade Marine Heat-Exchange Piping",
          discipline: "Plumbing" as const,
          type: "Pipe",
          points: [[5, 10, -2.5], [15, 5, -2.5], [25, 10, -2.5]] as [number, number, number][],
          color: "#0369A1",
          thickness: 5
        },
        {
          id: "mbs-ventilation",
          name: "Tunnel Carbon Monoxide Induction Fan Vent",
          discipline: "HVAC" as const,
          type: "Duct",
          points: [[8, 8, -2.0], [22, 12, -2.0]] as [number, number, number][],
          color: "#059669",
          thickness: 4
        }
      ];
    }

    // Default Olympic Transit Hub geometries, enriched with foundation & basement structures
    const defaultGeoms = [...MOCK_BIM_GEOMETRIES];
    defaultGeoms.push(
      {
        id: "basement-foundation-slab",
        name: "Reinforced Subgrade Foundation Slab (Basement B1)",
        discipline: "Structural" as const,
        type: "Slab",
        points: [[3, 3, -2.5], [27, 3, -2.5], [27, 17, -2.5], [3, 17, -2.5], [3, 3, -2.5]] as [number, number, number][],
        color: "#1E293B",
        thickness: 11
      },
      {
        id: "basement-pile-1",
        name: "Deep Structural Concrete Pile Footing A",
        discipline: "Structural" as const,
        type: "Pile",
        points: [[13, 8, -2.5], [14, 10, -2.5]] as [number, number, number][],
        color: "#334155",
        thickness: 13
      },
      {
        id: "basement-pile-2",
        name: "Deep Structural Concrete Pile Footing B",
        discipline: "Structural" as const,
        type: "Pile",
        points: [[17, 10, -2.5], [15, 12, -2.5]] as [number, number, number][],
        color: "#334155",
        thickness: 13
      },
      {
        id: "basement-sump-pump",
        name: "Subkey Level Waste Sump Drainage Loop",
        discipline: "Plumbing" as const,
        type: "Pipe",
        points: [[5, 5, -2.5], [25, 5, -2.5], [15, 10, -2.5], [5, 5, -2.5]] as [number, number, number][],
        color: "#1D4ED8",
        thickness: 3
      },
      {
        id: "basement-vent",
        name: "Basement High-Capacity Exhaust Air Intake",
        discipline: "HVAC" as const,
        type: "Duct",
        points: [[6, 12, -2.0], [24, 12, -2.0]] as [number, number, number][],
        color: "#047857",
        thickness: 4.5
      }
    );
    return defaultGeoms;
  }, [projectId]);

  // Filter drawings list with interactive floor levels isolation
  const activeDrawings = useMemo(() => {
    let filtered = projectGeometries.filter(g => filteredDisciplines.includes(g.discipline));
    if (activeLevelFilter !== 'all') {
      filtered = filtered.filter(g => getElementLevel(g.points) === activeLevelFilter);
    }
    return filtered;
  }, [projectGeometries, filteredDisciplines, activeLevelFilter]);

  // Combine actual database cursors with backup simulated coworker cursors
  const displayCollaborators = useMemo(() => {
    // If Firestore sync returned cursors, show them. Plus always keep the bot cursors 
    // to provide an immediately alive and highly interactive multiplayer feel!
    return [...collaborators, ...syntheticPeers];
  }, [collaborators, syntheticPeers]);

  // 5D Auto-takeoffs harvesting state extraction
  const harvestedParams = useMemo(() => {
    if (!inspectedElement) return null;
    return extractSpatialParameters(inspectedElement);
  }, [inspectedElement]);

  const materialsList = useMemo(() => {
    if (!inspectedElement) return [];
    return getMaterialGradesForDiscipline(inspectedElement.discipline);
  }, [inspectedElement]);

  const selectedMaterial = useMemo(() => {
    if (materialsList.length === 0) return null;
    return materialsList[selectedMaterialGradeIndex] || materialsList[0];
  }, [materialsList, selectedMaterialGradeIndex]);

  const costAndCarbonEstimate = useMemo(() => {
    if (!harvestedParams || !selectedMaterial) return null;
    const qty = harvestedParams.quantity;
    const cost = qty * selectedMaterial.unitPrice;
    const emissions = qty * selectedMaterial.carbonIntensity;
    
    // Check standard baseline profile to calculate delta CO2e savings context
    const standardGrade = materialsList.find(m => !m.isEcoGrade) || materialsList[0];
    const standardEmissions = qty * standardGrade.carbonIntensity;
    const savings = standardEmissions - emissions;

    return {
      totalCost: cost,
      totalEmissions: emissions,
      savings,
      carbonIntensity: selectedMaterial.carbonIntensity,
      unitPrice: selectedMaterial.unitPrice
    };
  }, [harvestedParams, selectedMaterial, materialsList]);

  const handleHarvestAndSync = async () => {
    if (!inspectedElement || !harvestedParams || !selectedMaterial || !costAndCarbonEstimate || !onAddBOQItem) return;
    setIsSyncingHarvest(true);
    setHarvestSyncSuccess(false);
    
    try {
      let finalCategory = `${inspectedElement.discipline} Work`;
      if (inspectedElement.discipline === 'Structural') {
        finalCategory = selectedMaterial.gradeName.toLowerCase().includes('steel') ? "Structural Steel" : "Structural Concrete";
      } else if (inspectedElement.discipline === 'HVAC') {
        finalCategory = "HVAC Ductwork";
      } else if (inspectedElement.discipline === 'Electrical') {
        finalCategory = "Electrical Cabling";
      } else if (inspectedElement.discipline === 'Plumbing') {
        finalCategory = "Plumbing & Drainage";
      } else if (inspectedElement.discipline === 'Architectural') {
        finalCategory = "Glazing & Curtain Walls";
      }

      await onAddBOQItem({
        category: finalCategory,
        elementType: `${inspectedElement.name}`,
        quantity: harvestedParams.quantity,
        unit: harvestedParams.unit,
        unitPrice: selectedMaterial.unitPrice,
        sourceLocation: `${inspectedElement.type} Coordinates`,
        notes: `🤖 5D Harvester extract | Material: ${selectedMaterial.gradeName} | Em. Carbon: ${costAndCarbonEstimate.totalEmissions.toFixed(0)} kg CO2e (${costAndCarbonEstimate.savings > 0 ? `Saved ${costAndCarbonEstimate.savings.toFixed(0)} kg!` : 'Standard Grade'})`,
        carbonIntensity: selectedMaterial.carbonIntensity,
        materialGrade: selectedMaterial.gradeName
      });
      setHarvestSyncSuccess(true);
    } catch (err) {
      console.error("Failed to sync 5D takeoff item:", err);
    } finally {
      setIsSyncingHarvest(false);
    }
  };

  return (
    <div className="bg-white text-gray-800 rounded border border-gray-250 border-gray-200 overflow-hidden flex flex-col h-full shadow-none text-xs font-sans">
      
      {/* Visualizer Header */}
      <div className="bg-gray-50 p-2.5 px-3 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Hammer className="w-3.5 h-3.5 text-blue-500" />
          <h2 className="font-bold text-[10px] tracking-tight uppercase text-gray-700">
            METRIC INTEGRATED BIM COOPERATIVE
          </h2>
          <span className="bg-emerald-50 text-emerald-700 text-[8px] py-0.5 px-1.5 border border-emerald-100 rounded font-mono font-bold animate-pulse">
            {displayCollaborators.length + 1} ONLINE
          </span>
        </div>
        
        {/* Navigation view modes */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 p-0.5 rounded">
          <button
            id="btn-view-2d"
            onClick={() => setViewMode('2d')}
            className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer ${viewMode === '2d' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Compass className="w-3 h-3" />
            2D FLOOR
          </button>
          <button
            id="btn-view-iso"
            onClick={() => setViewMode('iso')}
            className={`px-2 py-1 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition cursor-pointer ${viewMode === 'iso' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <Rotate3d className="w-3 h-3" />
            3D ISO
          </button>
        </div>
      </div>

      {/* Main split workarea (Viewer + Right Side Collaboration Panel) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-[380px]">
        
        {/* LEFT COLUMN: SVG BIM Viewer Stage */}
        <div className="md:col-span-8 relative bg-[#222225] text-slate-100 select-none flex flex-col justify-between border-r border-gray-150 border-gray-100">
          
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-15 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }}></div>
          
          {/* Level/Floor isolation selector bar */}
          <div className="absolute top-2.5 left-14 z-10 flex flex-wrap gap-1 bg-zinc-950/90 border border-zinc-700/85 p-1 rounded max-w-[70%] sm:max-w-[85%] overflow-x-auto shadow-lg backdrop-blur-sm">
            <span className="text-[7.5px] font-mono font-black tracking-widest text-zinc-400 self-center px-1 border-r border-zinc-800 uppercase hidden md:inline">
              ELEVATION Slices:
            </span>
            {[
              { id: 'all', name: '🏢 All (Full Stack)', h: 'Composite' },
              { id: 'basement', name: '🕳️ Basement', h: '-2.5m' },
              { id: 'ground', name: '🌱 Ground', h: '0.0m' },
              { id: 'level1', name: '⚡ Lvl 1', h: '3.2m' },
              { id: 'level2', name: '🚀 Lvl 2', h: '4.2m' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                id={`btn-lvl-${lvl.id}`}
                onClick={() => {
                  setActiveLevelFilter(lvl.id as any);
                  setInspectedElement(null);
                }}
                className={`px-1.5 py-1 rounded text-[8px] font-bold uppercase tracking-tight transition flex items-center gap-1 cursor-pointer ${activeLevelFilter === lvl.id ? 'bg-blue-600 text-white shadow font-extrabold' : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                title={`Filter components by elevation (${lvl.h})`}
              >
                <span>{lvl.name}</span>
                <span className="text-[7.5px] font-mono text-zinc-500 bg-zinc-950/40 px-1 rounded-sm">
                  {lvl.h}
                </span>
              </button>
            ))}
          </div>
          
          {/* Annotation Mode Notification banner */}
          {isAnnotationMode && (
            <div className="absolute top-2.5 right-2.5 z-10 bg-amber-500/95 border border-amber-600 text-white rounded p-1.5 px-2.5 text-[9px] font-semibold flex items-center gap-1.5 shadow-md animate-bounce">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>Annotation Mode ON. Click anywhere on elements to drop a pushpin!</span>
              <button 
                onClick={() => setIsAnnotationMode(false)}
                className="hover:bg-amber-600 p-0.5 rounded-full ml-1"
              >
                <X className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          )}

          {/* Canvas Floating Tools overlay */}
          <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 shadow-sm">
            <button
              onClick={() => setZoom(prev => Math.min(prev + 0.15, 2.5))}
              className="p-1.5 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded border border-zinc-700 transition"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev - 0.15, 0.4))}
              className="p-1.5 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded border border-zinc-700 transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleReset}
              className="p-1.5 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded border border-zinc-700 transition"
              title="Recenter View"
            >
              <Locate className="w-3.5 h-3.5" />
            </button>

            {viewMode === 'iso' && (
              <>
                <div className="border-t border-zinc-750 my-0.5" />
                <button
                  id="btn-rotate-ccw"
                  onClick={() => setIsoAngle(prev => (prev - 15 + 360) % 360)}
                  className="p-1.5 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
                  title="Rotate Left (CCW)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  id="btn-rotate-cw"
                  onClick={() => setIsoAngle(prev => (prev + 15) % 360)}
                  className="p-1.5 bg-zinc-900/95 hover:bg-zinc-850 text-zinc-300 hover:text-white rounded border border-zinc-700 transition cursor-pointer"
                  title="Rotate Right (CW)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
                <div className="text-[7.5px] font-mono text-zinc-400 text-center select-none font-bold py-0.5" title="Rotation bearing angle">
                  {isoAngle}°
                </div>
              </>
            )}
            
            <div className="border-t border-zinc-750 my-0.5" />

            <button
              id="btn-toggle-annotation-mode"
              onClick={() => setIsAnnotationMode(!isAnnotationMode)}
              className={`p-1.5 border transition cursor-pointer flex items-center justify-center rounded ${isAnnotationMode ? 'bg-amber-500 text-white border-amber-600 shadow-md font-bold' : 'bg-zinc-900/95 text-zinc-300 hover:text-white border-zinc-700'}`}
              title="Drop Collaborative Pin Note"
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Core Interactive SVG graphics viewport */}
          <svg
            className={`w-full h-full ${isAnnotationMode ? 'cursor-crosshair' : isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            viewBox={`0 0 ${width} ${height}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleSvgClick}
          >
            {/* Axial alignment markers */}
            <g opacity="0.08" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="2,2">
              {Array.from({ length: 11 }).map((_, i) => (
                <line key={`gx-${i}`} x1={i * (width / 10)} y1={0} x2={i * (width / 10)} y2={height} />
              ))}
              {Array.from({ length: 9 }).map((_, i) => (
                <line key={`gy-${i}`} x1={0} y1={i * (height / 8)} x2={width} y2={i * (height / 8)} />
              ))}
            </g>

            {/* BIM Architectural structural drawings path blocks */}
            <g>
              {activeDrawings.map((draw) => {
                const pathStr = getPathData(draw.points);
                const isInspected = inspectedElement?.id === draw.id;
                return (
                  <path
                    key={draw.id}
                    d={pathStr}
                    fill="none"
                    stroke={draw.color}
                    strokeWidth={draw.thickness * zoom * (isInspected ? 1.8 : 1)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300 hover:opacity-90 hover:stroke-sky-300 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInspectedElement(draw);
                    }}
                  />
                );
              })}
            </g>

            {/* Spatial clash circular warning indices */}
            <g>
              {clashes
                .filter(clash => {
                  const disciplineMatch = filteredDisciplines.includes(clash.discipline1) && 
                         filteredDisciplines.includes(clash.discipline2);
                  if (!disciplineMatch) return false;
                  if (activeLevelFilter !== 'all') {
                    return getZLevel(clash.coordinateZ) === activeLevelFilter;
                  }
                  return true;
                })
                .map((clash) => {
                  const screenPt = projectPoint(clash.coordinateX, clash.coordinateY, clash.coordinateZ);
                  const isSelected = selectedClash?.id === clash.id;
                  
                  const severityColors: Record<ClashSeverity, string> = {
                    [ClashSeverity.LOW]: '#3B82F6',
                    [ClashSeverity.MEDIUM]: '#F59E0B',
                    [ClashSeverity.HIGH]: '#EF4444',
                    [ClashSeverity.CRITICAL]: '#E11D48'
                  };
                  const color = severityColors[clash.severity] || '#EF4444';

                  if (clash.status === ClashStatus.RESOLVED) return null;

                  return (
                    <g 
                      key={clash.id} 
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClash(clash);
                      }}
                    >
                      <circle
                        cx={screenPt.x}
                        cy={screenPt.y}
                        r={isSelected ? 13 * zoom : 8 * zoom}
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        opacity="0.8"
                        className="animate-ping"
                      />
                      <circle
                        cx={screenPt.x}
                        cy={screenPt.y}
                        r={isSelected ? 7 * zoom : 4.5 * zoom}
                        fill={color}
                        stroke="#1F2937"
                        strokeWidth="1.5"
                      />
                      
                      {/* Floating tooltip hover metrics details */}
                      <g opacity="0" className="group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <rect
                          x={screenPt.x + 10}
                          y={screenPt.y - 30}
                          width="120"
                          height="36"
                          rx="3"
                          fill="#1F2937"
                          stroke={color}
                          strokeWidth="1.5"
                          opacity="0.95"
                        />
                        <text x={screenPt.x + 16} y={screenPt.y - 19} fill="#FFFFFF" fontSize="8" fontWeight="bold">
                          {clash.severity.toUpperCase()} BLOCKER
                        </text>
                        <text x={screenPt.x + 16} y={screenPt.y - 8} fill="#9CA3AF" fontSize="7" fontFamily="monospace">
                          X:{clash.coordinateX} Y:{clash.coordinateY} Z:{clash.coordinateZ}m
                        </text>
                      </g>
                    </g>
                  );
                })}
            </g>

            {/* Dropped Pins / Synchronized Observation Annotations rendering */}
            <g>
              {annotations
                .filter(ann => {
                  if (activeLevelFilter !== 'all') {
                    return getZLevel(ann.coordinateZ) === activeLevelFilter;
                  }
                  return true;
                })
                .map((ann) => {
                  const pt = projectPoint(ann.coordinateX, ann.coordinateY, ann.coordinateZ);
                return (
                  <g key={ann.id} className="cursor-pointer group">
                    
                    {/* Pulsating ground ring */}
                    <ellipse
                      cx={pt.x}
                      cy={pt.y}
                      rx={6 * zoom}
                      ry={3 * zoom}
                      fill="none"
                      stroke={ann.authorColor}
                      strokeWidth="1"
                      opacity="0.6"
                    />

                    {/* Vector pin representation shifted upwards */}
                    <g transform={`translate(${pt.x}, ${pt.y}) scale(${zoom})`}>
                      <path
                        d="M0,0 C-3.5,-7 -5.5,-9.5 -5.5,-13 A5,5 0 1,1 5.5,-13 C5.5,-9.5 3.5,-7 0,0 Z"
                        fill={ann.authorColor}
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      <circle cx="0" cy="-13" r="2.2" fill="#ffffff" />
                    </g>

                    {/* Speech bubble popover on hover */}
                    <g opacity="0" className="group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                      <rect
                        x={pt.x - 70}
                        y={pt.y - 62}
                        width="140"
                        height="44"
                        rx="4"
                        fill="#1F2937"
                        stroke={ann.authorColor}
                        strokeWidth="1.5"
                        opacity="0.95"
                      />
                      <polygon
                        points={`${pt.x - 4},${pt.y - 18} ${pt.x + 4},${pt.y - 18} ${pt.x},${pt.y - 12}`}
                        fill="#1F2937"
                      />
                      <text x={pt.x - 64} y={pt.y - 50} fill="#F9FAFB" fontSize="8" fontWeight="bold">
                        {ann.text.substring(0, 24)}{ann.text.length > 24 ? '...' : ''}
                      </text>
                      <text x={pt.x - 64} y={pt.y - 40} fill={ann.authorColor} fontSize="7" fontWeight="bold">
                        by {ann.author}
                      </text>
                      <text x={pt.x - 64} y={pt.y - 30} fill="#9CA3AF" fontSize="6.5" fontFamily="monospace">
                        GRID: X:{ann.coordinateX} Y:{ann.coordinateY} Z:{ann.coordinateZ}m
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>

            {/* Collaborative pointers/cursors of other people */}
            <g>
              {displayCollaborators.map((peer) => {
                const pt = projectPoint(peer.cursorX, peer.cursorY, 2.0); // assume peer cursor height 2.0m matches grid surface
                const isSyn = peer.id.startsWith('mock_peer_');
                return (
                  <g key={peer.id} className="pointer-events-none select-none transition-all duration-200">
                    {/* Translucent locator radial flare */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="6"
                      fill="none"
                      stroke={peer.color}
                      strokeWidth="1"
                      opacity="0.4"
                    />
                    {/* Classic angled cursor pointer arrow node */}
                    <polygon
                      points={`${pt.x},${pt.y} ${pt.x + 8},${pt.y + 8} ${pt.x + 2.5},${pt.y + 9}`}
                      fill={peer.color}
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                    {/* Floating nickname handle text tag */}
                    <rect
                      x={pt.x + 7}
                      y={pt.y + 10}
                      width={peer.name.length * 5.0 + 8}
                      height="12"
                      rx="2"
                      fill="#1F2937"
                      stroke={peer.color}
                      strokeWidth="0.5"
                    />
                    <text
                      x={pt.x + 11}
                      y={pt.y + 18}
                      fill="#FFFFFF"
                      fontSize="6.5"
                      fontWeight="bold"
                    >
                      {peer.name} {isSyn && '🕹️'}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Form Modal inlining inside canvas to type dropped notes */}
          {pendingAnnotation && (
            <div className="absolute inset-0 bg-[#1e1e24]/75 z-40 flex items-center justify-center p-4">
              <form onSubmit={handleSaveAnnotation} className="bg-white border text-gray-800 border-zinc-200 rounded max-w-xs w-full p-4 shadow-xl text-left animate-in zoom-in-95 leading-normal">
                <div className="flex items-center gap-1.5 mb-1 text-gray-900 border-b border-gray-100 pb-1.5">
                  <Pin className="w-4 h-4 text-amber-500" />
                  <h4 className="font-bold uppercase text-[9px] tracking-wide">Place Collaborative Flag</h4>
                </div>
                <div className="text-[9px] text-gray-500 font-mono mb-2">
                  LOCATED AT: X:{pendingAnnotation.coordinateX}m, Y:{pendingAnnotation.coordinateY}m, Z:{pendingAnnotation.coordinateZ}m
                </div>
                
                <div className="space-y-2 text-[10px]">
                  <textarea
                    required
                    placeholder="Describe spatial conflict or requested adjustment... (e.g. Relocate pipe tray here)"
                    value={pendingAnnotation.text}
                    onChange={(e) => setPendingAnnotation({ ...pendingAnnotation, text: e.target.value })}
                    rows={2}
                    className="w-full bg-gray-50 border border-gray-250 border-gray-200 p-2 text-[11px] rounded outline-none font-medium h-16"
                  />
                  
                  <div className="flex gap-1.5 text-[9px] font-bold uppercase tracking-wider justify-end">
                    <button
                      type="button"
                      onClick={() => setPendingAnnotation(null)}
                      className="px-2.5 py-1 text-gray-500 border border-gray-200 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-gray-900 text-white rounded hover:bg-gray-800 flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Pin Note
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Empty drawings check */}
          {activeDrawings.length === 0 && (
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-6 text-zinc-550 bg-[#1A1A1E]/95 select-none text-zinc-400">
              <Layers className="w-8 h-8 mb-2 stroke-1 text-zinc-600" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Layers Hidden</p>
              <p className="text-[9.5px] max-w-xs mt-0.5 leading-tight text-zinc-500">
                Check active systems under Legend overlay to view structural coordinates.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Interactive Selector (5D Harvester or Multiplayer Hub) */}
        <div className="md:col-span-4 bg-white flex flex-col justify-between overflow-y-auto max-h-[500px]">
          
          {/* Navigation sub-tabs inside sidebar */}
          <div className="flex border-b border-gray-200 bg-gray-50 p-1 gap-1">
            <button
              onClick={() => setActiveSidebarTab('harvester')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[9px] font-bold uppercase tracking-wider transition cursor-pointer ${activeSidebarTab === 'harvester' ? 'bg-white text-gray-900 border border-gray-250 border-gray-205 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Leaf className={`w-3 h-3 ${inspectedElement ? 'text-emerald-500 animate-pulse' : 'text-gray-400'}`} />
              5D Takeoff Harvester
            </button>
            <button
              onClick={() => setActiveSidebarTab('multiplayer')}
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded text-[9px] font-bold uppercase tracking-wider transition cursor-pointer ${activeSidebarTab === 'multiplayer' ? 'bg-white text-gray-950 border border-gray-250 border-gray-200 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Users className="w-3 h-3 text-sky-500" />
              Multiplayer ({displayCollaborators.length + 1})
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-between overflow-y-auto">
            {activeSidebarTab === 'harvester' ? (
              /* TAB A: 5D DATA HARVESTOR PANEL */
              <div className="p-3 flex-grow flex flex-col justify-between gap-3 text-xs">
                {!inspectedElement ? (
                  /* STANDBY UNSELECTED STATE */
                  <div className="flex-1 flex flex-col justify-center items-center text-center p-4 py-12 text-gray-400">
                    <div className="bg-emerald-50 p-3 rounded-full border border-emerald-100/50 mb-3 text-emerald-500">
                      <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: '6s' }} />
                    </div>
                    <span className="block font-bold font-sans text-gray-800 uppercase text-[10px] tracking-widest">
                      HARVESTER IN STANDBY
                    </span>
                    <p className="text-[10px] text-gray-400 max-w-xs mt-1.5 leading-relaxed font-sans">
                      Select or click any structural component on the 3D canvas (walls, ducts, or pipes) to extract spatial metrics and map sustainable material variables instantly in real-time.
                    </p>
                  </div>
                ) : (
                  /* HIGH-TECH PROPERTY EXTRACTOR WORKSPACE */
                  <div className="space-y-3 flex-grow flex flex-col justify-between">
                    <div>
                      {/* Active Element Banner */}
                      <div className="bg-slate-950 text-white rounded p-2.5 border border-slate-900 mb-2.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                              {inspectedElement.discipline} EXTRACTED SPEC
                            </span>
                            <h4 className="font-bold font-sans text-[11px] text-gray-100 leading-tight">
                              {inspectedElement.name}
                            </h4>
                          </div>
                          <button
                            onClick={() => setInspectedElement(null)}
                            className="bg-slate-800 hover:bg-slate-700 p-0.5 rounded text-gray-400"
                            title="De-select"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* 1. Spatial Parameters extracted dynamically */}
                      <div className="bg-gray-50 border border-gray-150 rounded p-2.5">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5 font-mono">
                          📏 Spatial Parameter Takeoffs (Euclidean Calculations)
                        </span>
                        
                        <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                          <div className="bg-white p-1 rounded border border-gray-100">
                            <span className="block text-[8px] text-gray-400 uppercase font-bold">Extracted Length</span>
                            <span className="font-bold text-gray-800 font-mono">
                              {harvestedParams?.length} m
                            </span>
                          </div>
                          <div className="bg-white p-1 rounded border border-gray-100">
                            <span className="block text-[8px] text-gray-400 uppercase font-bold font-sans">Cross-Section</span>
                            <span className="font-bold text-gray-800 font-mono">
                              {harvestedParams?.thickness} cm
                            </span>
                          </div>

                          {inspectedElement.type === 'Wall' || inspectedElement.discipline === 'Structural' ? (
                            <div className="bg-white p-1 rounded border border-gray-100 col-span-2">
                              <span className="block text-[8px] text-gray-400 uppercase font-bold font-sans">Calculated Concrete Volume</span>
                              <span className="font-bold text-emerald-600 font-mono text-xs">
                                {harvestedParams?.calculatedVolume} m³
                              </span>
                            </div>
                          ) : inspectedElement.type === 'Partition' ? (
                            <div className="bg-white p-1 rounded border border-gray-100 col-span-2">
                              <span className="block text-[8px] text-gray-400 uppercase font-bold font-sans">Drywall Surface Area</span>
                              <span className="font-bold text-indigo-600 font-mono text-xs">
                                {harvestedParams?.calculatedArea} m²
                              </span>
                            </div>
                          ) : (
                            <div className="bg-white p-1 rounded border border-gray-100 col-span-2">
                              <span className="block text-[8px] text-gray-400 uppercase font-bold font-sans">Linear Metric length</span>
                              <span className="font-bold text-indigo-600 font-mono text-xs">
                                {harvestedParams?.length} linear meters
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 2. Material spec alternative simulator */}
                      <div className="mt-2.5">
                        <label className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1 font-mono">
                          🌱 Dynamic Material Grade Simulator (5D Carbon Impact)
                        </label>
                        <select
                          value={selectedMaterialGradeIndex}
                          onChange={(e) => setSelectedMaterialGradeIndex(parseInt(e.target.value))}
                          className="w-full bg-white border border-gray-200 rounded p-2 text-[10.5px] font-bold text-gray-700 outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          {materialsList.map((grade, idx) => (
                            <option key={idx} value={idx}>
                              {grade.gradeName} {grade.isEcoGrade ? ' [♻️ green alt]' : ''}
                            </option>
                          ))}
                        </select>
                        <p className="text-[9px] text-gray-400 leading-tight mt-1 ml-1 font-sans">
                          {selectedMaterial?.notes}
                        </p>
                      </div>

                      {/* Estimations metrics dynamic cards */}
                      {costAndCarbonEstimate && (
                        <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded bg-emerald-50/40 border border-emerald-100/50">
                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase font-sans">Estimated Item Cost</span>
                            <span className="font-bold font-mono text-gray-900 text-sm">
                              ${costAndCarbonEstimate.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="block text-[8px] text-gray-400 leading-none font-sans font-sans">
                              @ ${costAndCarbonEstimate.unitPrice}/unit
                            </span>
                          </div>

                          <div>
                            <span className="block text-[8px] font-bold text-gray-500 uppercase font-sans">Embodied Carbon</span>
                            <span className="font-bold font-mono text-gray-900 text-sm block leading-tight">
                              {costAndCarbonEstimate.totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-[9px] font-medium text-gray-500 font-sans font-sans">kg CO₂e</span>
                            </span>
                            <span className="block text-[8px] text-gray-400 leading-none font-sans font-mono font-sans font-sans">
                              intensity: {costAndCarbonEstimate.carbonIntensity} kg/unit
                            </span>
                          </div>

                          {costAndCarbonEstimate.savings > 0 ? (
                            <div className="col-span-2 bg-emerald-100/75 border border-emerald-200 rounded p-1.5 flex items-center gap-1.5 mt-1 text-[9.5px] text-emerald-800 font-bold font-sans">
                              <Sprout className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                              <span>Eco-Design Choice Saved: {costAndCarbonEstimate.savings.toFixed(1)} kg CO₂e!</span>
                            </div>
                          ) : (
                            <div className="col-span-2 bg-gray-100 border border-gray-200 rounded p-1.5 text-[9px] text-gray-505 text-gray-500 font-medium font-sans">
                              Consider selecting a recycled or eco-conscious material alternative above to offset structural carbon loads.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Sync button to live database takeoff */}
                    <div className="pt-2">
                      {harvestSyncSuccess ? (
                        <div className="bg-emerald-600 text-white p-2.5 rounded flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-center animate-pulse font-sans">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                          <span>Harvest Saved To Cloud!</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleHarvestAndSync}
                          disabled={isSyncingHarvest}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-300 text-white font-bold py-2.5 px-3 rounded uppercase text-[10px] tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                        >
                          {isSyncingHarvest ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin font-sans" />
                              <span>Harvesting spatial logic...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5 py-0.5" />
                              <span>Harvest & Sync to Cloud Takeoffs (5D)</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* TAB B: MULTIPLAYER HUB */
              <div className="flex-grow flex flex-col justify-between overflow-y-auto">
                <div>
                  {/* Section 1: Active Collaborator details customization */}
                  <div className="p-3 border-b border-gray-200 bg-gray-50/50">
                    <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wider block">YOUR PILOT CURSOR</span>
                    
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Custodian Nickname..."
                        value={myProfile.name}
                        maxLength={22}
                        onChange={(e) => handleChangeProfileName(e.target.value)}
                        className="w-full bg-white border border-gray-200 p-1.5 rounded text-[11px] font-semibold text-gray-800 focus:outline-none focus:border-gray-500 font-sans"
                      />
                      
                      {/* Pick pointer colors circles */}
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[8px] uppercase font-bold text-gray-400 mr-1 block">POINTER TYPE:</span>
                        <div className="flex flex-wrap gap-1">
                          {COLLAB_COLORS.map((hex) => (
                            <button
                              key={hex}
                              onClick={() => handleChangeProfileColor(hex)}
                              className="w-4 h-4 rounded-full border border-white transition flex items-center justify-center cursor-pointer hover:scale-110"
                              style={{ backgroundColor: hex }}
                              title={`Color pointers: ${hex}`}
                            >
                              {myProfile.color === hex && (
                                <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Online Colleagues roster */}
                  <div className="p-3 border-b border-gray-250 border-gray-200 flex-grow max-h-[140px] overflow-y-auto">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wider font-sans">COLLABORATORS ONLINE ({displayCollaborators.length + 1})</span>
                      <Users className="w-3 h-3 text-gray-400" />
                    </div>
                    
                    <div className="space-y-1">
                      {/* Self */}
                      <div className="flex items-center justify-between p-1.5 bg-gray-55/40 bg-gray-50 border border-gray-150 rounded leading-none">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: myProfile.color }} />
                          <span className="font-semibold text-gray-900 font-sans font-bold">{myProfile.name}</span>
                        </div>
                        <span className="text-[8px] bg-gray-200 text-gray-600 font-bold px-1 rounded uppercase tracking-wide font-sans">YOU</span>
                      </div>

                      {/* Connected Active Peers */}
                      {displayCollaborators.map((peer) => {
                        const isSyn = peer.id.startsWith('mock_peer_');
                        return (
                          <div key={peer.id} className="flex items-center justify-between p-1 border border-gray-100 rounded leading-none hover:bg-gray-25">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: peer.color }} />
                              <span className="text-gray-700 font-medium font-sans">{peer.name}</span>
                            </div>
                            <span className="text-[7.5px] text-gray-400 font-mono">
                              {isSyn ? 'SIMULATOR' : `UID: ${peer.id.slice(-5)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 3: dropped Annotations lists */}
                  <div className="p-3 flex-grow flex flex-col justify-start max-h-[160px] overflow-y-auto">
                    <div className="flex justify-between items-center mb-1.5 border-b border-gray-100 pb-1">
                      <span className="text-[8px] uppercase font-bold text-gray-400 tracking-wider">COLLABORATIVE pinned NOTES ({annotations.length})</span>
                      <MessageSquare className="w-3 h-3 text-amber-500" />
                    </div>

                    <div className="space-y-1.5 pr-1">
                      {annotations.length === 0 ? (
                        <div className="text-[10px] text-gray-400 italic text-center py-4 bg-gray-50/50 rounded border border-dashed border-gray-250 font-sans">
                          No pinned flags on the model. Toggle Annotation pin tool left to drop observations!
                        </div>
                      ) : (
                        annotations.map((ann) => (
                          <div 
                            key={ann.id} 
                            className="p-1.5 border border-gray-100 hover:border-gray-300 rounded leading-normal transition flex justify-between items-start gap-1 font-sans"
                            style={{ borderLeftWidth: '3px', borderLeftColor: ann.authorColor }}
                          >
                            <div>
                              <p className="font-bold text-gray-900 text-[10px] font-sans">{ann.text}</p>
                              <div className="text-[8px] text-gray-400 font-medium space-x-1 font-mono">
                                <span className="font-sans">by <strong>{ann.author}</strong></span>
                                <span>•</span>
                                <span>Coords: X:{ann.coordinateX}m, Y:{ann.coordinateY}m</span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleDeleteAnnotationItem(ann.id)}
                              className="text-gray-400 hover:text-red-500 cursor-pointer p-0.5"
                              title="Remove Annotation Pin Note"
                            >
                              <Trash2 className="w-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Bottom instruction help pill */}
          <div className="bg-gray-55/35 bg-gray-50 p-2 text-[9px] text-gray-400 border-t border-gray-200 leading-tight">
            <span className="font-bold flex items-center gap-1 uppercase block mb-0.5 text-zinc-550">
              <HelpCircle className="w-3 h-3 text-zinc-400" /> Multi-User Guidance:
            </span>
            <span>Open this portal link in a separate tab or device side-by-side to witness real-time participant pointer cursors and pushpin coordinates synchronizing instantaneously!</span>
          </div>

        </div>
      </div>

    </div>
  );
}
