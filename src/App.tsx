import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  Project, 
  Clash, 
  BOQItem, 
  ProjectStatus, 
  ClashStatus, 
  ClashSeverity,
  BCFIssue 
} from './types';
import { 
  createProject, 
  listenToMyProjects, 
  createClash, 
  listenToClashes, 
  updateClashStatus, 
  deleteClash, 
  createBOQItem, 
  createManyBOQItems,
  listenToBOQItems, 
  deleteBOQItem,
  createBCFIssue,
  deleteBCFIssue,
  updateBCFIssueSyncState,
  listenToBCFIssues
} from './dbService';
import { SEEDED_CLASHES, SEEDED_BOQ } from './initialData';
import BIMViewer from './components/BIMViewer';
import MetricDashboard from './components/MetricDashboard';
import ClashManager from './components/ClashManager';
import QuantitySurveyor from './components/QuantitySurveyor';
import BCFIssueTracker from './components/BCFIssueTracker';
import SheetsPortal from './components/SheetsPortal';
import { 
  Building2, 
  Compass, 
  Calculator, 
  LayoutDashboard, 
  Plus, 
  Briefcase, 
  MapPin, 
  LogOut, 
  LogIn, 
  User as UserIcon, 
  Moon, 
  Sun, 
  HelpCircle,
  FileCheck2,
  HardHat,
  Database,
  FileSpreadsheet,
  Wifi,
  WifiOff,
  Activity,
  ShieldAlert,
  ServerCrash,
  AlertTriangle,
  RefreshCw,
  Layers,
  FileWarning,
  Coins,
  ChevronRight
} from 'lucide-react';

export default function App() {
  // Authentication status
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<{ code: string; message: string } | null>(null);

  // 🛡️ Global Resiliency & Pipeline Control States
  const [globalPipeline, setGlobalPipeline] = useState<'healthy' | 'latency' | 'offline' | 'corrupted'>('healthy');
  const [browserOnline, setBrowserOnline] = useState<boolean>(typeof window !== 'undefined' ? window.navigator.onLine : true);
  const [offlineClashes, setOfflineClashes] = useState<Clash[]>([]);
  const [offlineBOQ, setOfflineBOQ] = useState<BOQItem[]>([]);
  const [offlineBCF, setOfflineBCF] = useState<BCFIssue[]>([]);
  const [globalToast, setGlobalToast] = useState<{ text: string; type: 'success' | 'warning' | 'error' | 'info' } | null>(null);
  const [resilientActionLogs, setResilientActionLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] [system-setup] Central Pipeline Gateway active & monitoring. Ready to intercept errors.`,
    `[${new Date().toLocaleTimeString()}] [diagnostics] Live database integrity validations loaded.`
  ]);

  // Active projects and selections state
  const [projectsList, setProjectsList] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [selectedClash, setSelectedClash] = useState<Clash | null>(null);

  // Subcollections lists
  const [activeClashesList, setActiveClashesList] = useState<Clash[]>([]);
  const [activeBOQList, setActiveBOQList] = useState<BOQItem[]>([]);
  const [activeBCFIssuesList, setActiveBCFIssuesList] = useState<BCFIssue[]>([]);

  // Toggle Filters and Tabs
  const [activeTab, setActiveTab] = useState<'coordination' | 'takeoffs' | 'bcf-feed' | 'sheets-portal'>('sheets-portal');
  const [filteredDisciplines, setFilteredDisciplines] = useState<string[]>(['Structural', 'HVAC', 'Plumbing', 'Electrical', 'Architectural']);

  // Project Creation and 3D Integration guide popups
  const [showAddProject, setShowAddProject] = useState(false);
  const [showImportGuide, setShowImportGuide] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    name: '',
    location: '',
    coordinates: '',
    area: '',
    revision: ''
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  // Guest-mode projects and mappings with persistence
  const [guestProjects, setGuestProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('bim_portal_projects');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return [
      {
        id: 'demo_olympic_complex',
        name: 'Olympic Transit Hub Terminal 2',
        location: 'Paris, France',
        status: ProjectStatus.ACTIVE,
        ownerId: 'demo_user',
        createdAt: new Date(),
        updatedAt: new Date(),
        coordinates: '48.8566° N, 2.3522° E',
        area: '45,200 m²',
        revision: 'RVT-T2-v4.5'
      },
      {
        id: 'demo_hudson_yards',
        name: 'Hudson Yards Corporate Tower A',
        location: 'New York, USA',
        status: ProjectStatus.ACTIVE,
        ownerId: 'demo_user',
        createdAt: new Date(),
        updatedAt: new Date(),
        coordinates: '40.7537° N, 74.0018° W',
        area: '82,000 m²',
        revision: 'RVT-HY-v7.1'
      },
      {
        id: 'demo_marina_bay',
        name: 'Marina Bay Sands Hotel Tower D',
        location: 'Singapore',
        status: ProjectStatus.ACTIVE,
        ownerId: 'demo_user',
        createdAt: new Date(),
        updatedAt: new Date(),
        coordinates: '1.2847° N, 103.8610° E',
        area: '64,100 m²',
        revision: 'RVT-MBS-v3.0'
      }
    ];
  });

  const [guestClashesMap, setGuestClashesMap] = useState<Record<string, Clash[]>>(() => {
    const saved = localStorage.getItem('bim_portal_clashes');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    
    const HUDSON_CLASHES = [
      {
        title: "Primary 150mm Wet Sprinkler Line vs HVAC Supply Return",
        discipline1: "Plumbing",
        discipline2: "HVAC",
        severity: ClashSeverity.CRITICAL,
        status: ClashStatus.OPEN,
        coordinateX: 8.2,
        coordinateY: 15.6,
        coordinateZ: 4.8,
        assignedTo: "Evelyn Reed (MEP Manager)"
      },
      {
        title: "Structural Plate Girders overlapping Glass Elevator Shaft",
        discipline1: "Structural",
        discipline2: "Architectural",
        severity: ClashSeverity.HIGH,
        status: ClashStatus.IN_REVIEW,
        coordinateX: 14.1,
        coordinateY: 10.2,
        coordinateZ: 12.5,
        assignedTo: "Marcus Thorne (Lead Architect)"
      },
      {
        title: "High Voltage Cable Bus vs Main Rainwater Leader",
        discipline1: "Electrical",
        discipline2: "Plumbing",
        severity: ClashSeverity.HIGH,
        status: ClashStatus.OPEN,
        coordinateX: 23.4,
        coordinateY: 6.8,
        coordinateZ: 3.1,
        assignedTo: "Julian Vance (Electrical Engineer)"
      }
    ];

    const MARINA_CLASHES = [
      {
        title: "Post-Tensioned Cable Ducts vs Rainwater Drainage pipe",
        discipline1: "Structural",
        discipline2: "Plumbing",
        severity: ClashSeverity.CRITICAL,
        status: ClashStatus.OPEN,
        coordinateX: 19.5,
        coordinateY: 12.4,
        coordinateZ: 1.8,
        assignedTo: "Kenji Sato (Structural Lead)"
      },
      {
        title: "Busduct Trunking intersecting Smoke Extraction Plenum",
        discipline1: "Electrical",
        discipline2: "HVAC",
        severity: ClashSeverity.MEDIUM,
        status: ClashStatus.RESOLVED,
        coordinateX: 4.5,
        coordinateY: 7.8,
        coordinateZ: 5.2,
        assignedTo: "Lim Wei (MEP Coordinator)"
      }
    ];

    return {
      'demo_olympic_complex': SEEDED_CLASHES.map((c, i) => ({
        ...c,
        id: `demo_clash_${i}`,
        projectId: 'demo_olympic_complex',
        aiRecommendation: i === 3 ? 'Recommended Shifting Sprinkler lateral pipeline up by +0.15m to resolve high priority Architectural element clash.' : 'Click "Query Gemini Advisory Guideline" to invoke structural design coordination proposals.',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      'demo_hudson_yards': HUDSON_CLASHES.map((c, i) => ({
        ...c,
        id: `hudson_clash_${i}`,
        projectId: 'demo_hudson_yards',
        aiRecommendation: 'Click "Query Gemini Advisory Guideline" to resolve Hudson Yards specific MEP overlap.',
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      'demo_marina_bay': MARINA_CLASHES.map((c, i) => ({
        ...c,
        id: `marina_clash_${i}`,
        projectId: 'demo_marina_bay',
        aiRecommendation: 'Click "Query Gemini Advisory Guideline" to resolve Marina Bay Sands overhanging loads interference.',
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    };
  });

  const [guestBOQsMap, setGuestBOQsMap] = useState<Record<string, BOQItem[]>>(() => {
    const saved = localStorage.getItem('bim_portal_boqs');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }

    const HUDSON_BOQ = [
      {
        category: "Structural Steel",
        elementType: "High-Tensile Grade 50 Steel Columns",
        quantity: 184.0,
        unit: "m",
        unitPrice: 145.00,
        sourceLocation: "Core columns Grid C2-E9 (Level 2-10)",
        notes: "Requires ultrasonic testing of welded splices onsite.",
        carbonIntensity: 180,
        materialGrade: "ASTM A992 Structural Steel"
      },
      {
        category: "Glazing & Curtain Walls",
        elementType: "Triple-Glazed Unitized Low-E Coated Panels",
        quantity: 120.0,
        unit: "pcs",
        unitPrice: 520.00,
        sourceLocation: "Exterior skin - Levels 2-25",
        notes: "Requires heavy crane lifting layout and structural anchor plates.",
        carbonIntensity: 90,
        materialGrade: "Triple Thermal Insulation Tempered Coating"
      },
      {
        category: "HVAC Ductwork",
        elementType: "Rectangular Acoustically Lined Distribution Main",
        quantity: 95.0,
        unit: "m",
        unitPrice: 58.00,
        sourceLocation: "Main core riser shaft Level 4 east",
        notes: "Pre-fabricated offsite.",
        carbonIntensity: 18,
        materialGrade: "Galvanized Metal Profile"
      }
    ];

    const MARINA_BOQ = [
      {
        category: "Structural Concrete",
        elementType: "Ultra-High Performance Fiber-Reinforced Concrete",
        quantity: 210.5,
        unit: "m3",
        unitPrice: 285.00,
        sourceLocation: "Overhanging Skybridge Cantilever Arch",
        notes: "Special micro-silica compound for premium strength.",
        carbonIntensity: 310,
        materialGrade: "UHPFRC C120 grade"
      },
      {
        category: "Electrical Cabling",
        elementType: "Fire-Resistant MIMS Power Feeder Cables",
        quantity: 340.0,
        unit: "m",
        unitPrice: 62.00,
        sourceLocation: "Generator backup systems to substations",
        notes: "Halogen free mineral insulated structure.",
        carbonIntensity: 11.2,
        materialGrade: "Copper Sheathed Mineral Insulated"
      }
    ];

    return {
      'demo_olympic_complex': SEEDED_BOQ.map((b, i) => ({
        ...b,
        id: `demo_boq_${i}`,
        projectId: 'demo_olympic_complex',
        totalPrice: Number((b.quantity * b.unitPrice).toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      'demo_hudson_yards': HUDSON_BOQ.map((b, i) => ({
        ...b,
        id: `hudson_boq_${i}`,
        projectId: 'demo_hudson_yards',
        totalPrice: Number((b.quantity * b.unitPrice).toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      'demo_marina_bay': MARINA_BOQ.map((b, i) => ({
        ...b,
        id: `marina_boq_${i}`,
        projectId: 'demo_marina_bay',
        totalPrice: Number((b.quantity * b.unitPrice).toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date()
      }))
    };
  });

  const [guestBCFMap, setGuestBCFMap] = useState<Record<string, BCFIssue[]>>(() => {
    const saved = localStorage.getItem('bim_portal_bcfs');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    return {
      'demo_olympic_complex': [],
      'demo_hudson_yards': [],
      'demo_marina_bay': []
    };
  });

  // Persist guest data
  useEffect(() => {
    localStorage.setItem('bim_portal_projects', JSON.stringify(guestProjects));
  }, [guestProjects]);

  useEffect(() => {
    localStorage.setItem('bim_portal_clashes', JSON.stringify(guestClashesMap));
  }, [guestClashesMap]);

  useEffect(() => {
    localStorage.setItem('bim_portal_boqs', JSON.stringify(guestBOQsMap));
  }, [guestBOQsMap]);

  useEffect(() => {
    localStorage.setItem('bim_portal_bcfs', JSON.stringify(guestBCFMap));
  }, [guestBCFMap]);

  // Helper to show app-wide warning toasters
  const showGlobalToast = (text: string, type: 'success' | 'warning' | 'error' | 'info' = 'success') => {
    setGlobalToast({ text, type });
    setTimeout(() => setGlobalToast(null), 5000);
  };

  // Log output to Central Resiliency Monitoring Console
  const addResilientLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setResilientActionLogs(prev => [...prev, `[${time}] ${msg}`]);
  };

  // Monitor hardware network socket connectivity
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setBrowserOnline(true);
      setGlobalPipeline('healthy');
      showGlobalToast("Network connection restored. CAD link re-established.", "success");
      addResilientLog("CONNECTIVITY: Workstation physical link went ONLINE.");
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      setGlobalPipeline('offline');
      showGlobalToast("Network connection dropped! Safe-guard storage enabled.", "error");
      addResilientLog("CONNECTIVITY: Workstation socket went OFFLINE. Initialized failover backup.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      
      // If user logs out, activate local guest workspaces
      if (!user) {
        setProjectsList(guestProjects);
        setActiveProject(guestProjects[0]);
        setActiveClashesList([]);
        setActiveBOQList([]);
        setActiveBCFIssuesList([]);
      }
    });
    return unsubscribe;
  }, [guestProjects]);

  // Listen to owner's projects
  useEffect(() => {
    if (!currentUser) {
      setProjectsList(guestProjects);
      if (!activeProject || !guestProjects.some(g => g.id === activeProject.id)) {
        setActiveProject(guestProjects[0]);
      }
      return;
    }

    const unsubscribe = listenToMyProjects((projects) => {
      setProjectsList(projects);
      
      // Select first project as active if none is active
      if (projects.length > 0 && !activeProject) {
        setActiveProject(projects[0]);
      }
    }, (error) => {
      console.error("Error loading user projects portfolio:", error);
    });

    return unsubscribe;
  }, [currentUser, guestProjects, activeProject]);

  // Listen to subcollections (Clashes & BOQs) of the selected active project
  useEffect(() => {
    if (!activeProject) {
      setActiveClashesList([]);
      setActiveBOQList([]);
      setActiveBCFIssuesList([]);
      return;
    }

    if (!currentUser) {
      setActiveClashesList([]);
      setActiveBOQList([]);
      setActiveBCFIssuesList([]);
      return;
    }

    // Bind real-time snapshot bindings for dynamic BIM modeling interferences
    const unsubscribeClashes = listenToClashes(activeProject.id, (clashes) => {
      setActiveClashesList(clashes);
      
      // If previous selected clash is deleted, clear state
      if (selectedClash && !clashes.some(c => c.id === selectedClash.id)) {
        setSelectedClash(null);
      }
    });

    // Bind real-time snapshot bindings for surveying takeoffs
    const unsubscribeBOQ = listenToBOQItems(activeProject.id, (boqItems) => {
      setActiveBOQList(boqItems);
    });

    // Bind real-time snapshot bindings for live BCF collaboration format feed
    const unsubscribeBCF = listenToBCFIssues(activeProject.id, (issues) => {
      setActiveBCFIssuesList(issues);
    });

    return () => {
      unsubscribeClashes();
      unsubscribeBOQ();
      unsubscribeBCF();
    };
  }, [activeProject, currentUser]);

  // Handle manual project instantiation and seed with sample BIM data instantly!
  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectForm.name.trim() || !newProjectForm.location.trim()) return;

    setIsCreatingProject(true);
    try {
      const pId = currentUser ? await createProject(newProjectForm.name, newProjectForm.location) : `guest_project_${Date.now()}`;
      if (pId) {
        const uProj: Project = {
          id: pId,
          name: newProjectForm.name,
          location: newProjectForm.location,
          status: ProjectStatus.ACTIVE,
          ownerId: currentUser?.uid || 'guest_user',
          createdAt: new Date(),
          updatedAt: new Date(),
          coordinates: newProjectForm.coordinates || '34.0522° N, 118.2437° W',
          area: newProjectForm.area || '28,400 m²',
          revision: newProjectForm.revision || 'RVT-N-v1.0'
        };

        if (currentUser) {
          // Build initial pre-load mock elements inside the project under active User scope
          for (const clash of SEEDED_CLASHES) {
            await createClash(pId, clash);
          }
          for (const boq of SEEDED_BOQ) {
            await createBOQItem(pId, boq);
          }
        } else {
          // Add newly instantiated guest project & seed subcollection mappings locally
          setGuestProjects(prev => [...prev, uProj]);
          setGuestClashesMap(prev => ({
            ...prev,
            [pId]: SEEDED_CLASHES.map((c, i) => ({
              ...c,
              id: `guest_${pId}_clash_${i}`,
              projectId: pId,
              aiRecommendation: 'Click "Query Gemini Advisory Guideline" to invoke structural design coordination proposals.',
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          }));
          setGuestBOQsMap(prev => ({
            ...prev,
            [pId]: SEEDED_BOQ.map((b, i) => ({
              ...b,
              id: `guest_${pId}_boq_${i}`,
              projectId: pId,
              totalPrice: Number((b.quantity * b.unitPrice).toFixed(2)),
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          }));
          setGuestBCFMap(prev => ({
            ...prev,
            [pId]: []
          }));
        }

        setActiveProject(uProj);
        setNewProjectForm({
          name: '',
          location: '',
          coordinates: '',
          area: '',
          revision: ''
        });
        setShowAddProject(false);
        showGlobalToast("Initialized new BIM Workspace successfully!", "success");
        addResilientLog(`PORTFOLIO: Connected workspace "${uProj.name}" - ${uProj.location}. Loaded CAD stream.`);
      }
    } catch (error) {
      console.error("Project setup failed:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  // Google Login handling
  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
      setAuthError(null);
      showGlobalToast("Authorized successfully via Google Auth!", "success");
    } catch (err: any) {
      console.error("Authentication popup aborted:", err);
      const errCode = err?.code || 'auth/popup-closed-by-user';
      const errMsg = err?.message || 'The Google auth popup window was closed or blocked.';
      setAuthError({
        code: errCode,
        message: errMsg
      });
      showGlobalToast("Login blocked or cancelled. See help banner.", "error");
    }
  };

  // Logout handling
  const handleLogout = async () => {
    try {
      await logOut();
    } catch (err) {
      console.error("Sign out process error:", err);
    }
  };

  // 🛡️ RECOVERY SYNC MECHANISM
  const handleRecoverAndSync = async () => {
    if (offlineClashes.length === 0 && offlineBOQ.length === 0 && offlineBCF.length === 0) {
      setGlobalPipeline('healthy');
      showGlobalToast("Pipeline online. No cached records to synchronise.", "success");
      return;
    }

    showGlobalToast("Connecting gateway... pushing offline records...", "info");
    addResilientLog("RECOVERY TRACE: Initiating offline records replication handshake...");

    try {
      const pId = activeProject?.id || 'demo_olympic_complex';

      // Push clashes
      for (const item of offlineClashes) {
        if (currentUser && activeProject) {
          await createClash(pId, {
            title: item.title,
            status: item.status,
            severity: item.severity,
            discipline1: item.discipline1,
            discipline2: item.discipline2,
            assignedTo: item.assignedTo,
            coordinateX: item.coordinateX,
            coordinateY: item.coordinateY,
            coordinateZ: item.coordinateZ
          });
        }
      }

      for (const item of offlineBOQ) {
        if (currentUser && activeProject) {
          await createBOQItem(pId, {
            category: item.category,
            elementType: item.elementType,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            sourceLocation: item.sourceLocation,
            notes: item.notes,
            carbonIntensity: item.carbonIntensity || 0,
            materialGrade: item.materialGrade || 'Standard'
          });
        }
      }

      for (const item of offlineBCF) {
        if (currentUser && activeProject) {
          await createBCFIssue(pId, {
            projectId: pId,
            guid: item.guid || `guid_${Date.now()}`,
            title: item.title,
            description: item.description || '',
            status: item.status || 'open',
            priority: item.priority || 'medium',
            creationDate: item.creationDate || new Date().toISOString(),
            creationAuthor: item.creationAuthor || 'BIM System',
            assignedTo: item.assignedTo || 'Unassigned',
            coordinateX: item.coordinateX,
            coordinateY: item.coordinateY,
            coordinateZ: item.coordinateZ,
            discipline1: item.discipline1,
            discipline2: item.discipline2,
            comment: item.comment || '',
            synced: item.synced,
            syncedClashId: item.syncedClashId || ''
          });
        }
      }

      setOfflineClashes([]);
      setOfflineBOQ([]);
      setOfflineBCF([]);
      setGlobalPipeline('healthy');
      showGlobalToast("Ecosystem online! Successfully synchronized custom cached records.", "success");
      addResilientLog(`SUCCESS: Transmitted ${offlineClashes.length + offlineBOQ.length + offlineBCF.length} buffered workstation coordinates.`);
    } catch (err: any) {
      console.error(err);
      showGlobalToast("Sync failed. Local safe-guard cache remains active.", "error");
      addResilientLog(`RECOVERY ERROR: Remote server rejected synchronisation: ${err.message || err.toString()}`);
    }
  };

  // Subcollection modification triggers
  const handleAddNewClash = async (fields: any) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'corrupted') {
      showGlobalToast("Verification Refused: Clash payload has malformed spatial tags.", "error");
      addResilientLog("BLOCKED TRANSACTION: Blocked incoming clash due to active stream corrupt signature.");
      return;
    }

    if (globalPipeline === 'offline') {
      const offItem: Clash = {
        ...fields,
        id: `offline_clash_${Date.now()}`,
        projectId: pId,
        aiRecommendation: 'Safe-guarded offline. This record resides in browser-local cache.',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setOfflineClashes(prev => [...prev, offItem]);
      showGlobalToast("Workstation Offline: Saved clash item to local browser vault.", "warning");
      addResilientLog(`SAFEGUARD CACHE: Cached custom clash [${fields.discipline1}/${fields.discipline2}] "${fields.title}" locally.`);
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast("Data pipeline has 2.0s latency. Processing transaction...", "warning");
      addResilientLog("LATENCY INJECTOR: Waiting 2000ms before dispatching database write commit.");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await createClash(activeProject.id, fields);
      } else {
        const newItem: Clash = {
          ...fields,
          id: `demo_clash_${Date.now()}`,
          projectId: pId,
          aiRecommendation: 'Click "Query Gemini Advisory Guideline" to invoke structural design coordination proposals.',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setGuestClashesMap(prev => ({
          ...prev,
          [pId]: [newItem, ...(prev[pId] || [])]
        }));
      }
      showGlobalToast("Clash added successfully to 3D database model.", "success");
      addResilientLog(`TRANSMIT: Dispatched clash ticket "${fields.title}" to remote Firestore.`);
    } catch (e: any) {
      showGlobalToast(`Setup error: ${e.message}`, "error");
      addResilientLog(`ERROR CATCH: Caught exception during clash setup: ${e.toString()}`);
    }
  };

  const handleUpdateClash = async (clashId: string, status: ClashStatus, advice?: string) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'offline') {
      if (offlineClashes.some(c => c.id === clashId)) {
        setOfflineClashes(prev => prev.map(c => c.id === clashId ? { ...c, status, ...(advice ? { aiRecommendation: advice } : {}) } : c));
        showGlobalToast("Offline Cache Updated: Modified clash ticket status local-only.", "warning");
        addResilientLog(`SAFEGUARD UPDATE: Altered status of offline clash ${clashId} to "${status}".`);
        return;
      }
      showGlobalToast("Operation Rejected: Cannot write to live cloud records while offline.", "error");
      addResilientLog("BLOCKED TRANSACTION: Blocked state update on cloud records due to connection drop.");
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast("Packet delayed... resolving clash state...", "warning");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await updateClashStatus(activeProject.id, clashId, status, advice);
      } else {
        setGuestClashesMap(prev => ({
          ...prev,
          [pId]: (prev[pId] || []).map(c => c.id === clashId ? { ...c, status, ...(advice ? { aiRecommendation: advice } : {}) } : c)
        }));
      }
      showGlobalToast("Model collision status synchronized successfully.", "success");
      addResilientLog(`TRANSMIT: Updated clash status to "${status}" for card ID: ${clashId}`);

      if (selectedClash?.id === clashId) {
        setSelectedClash(prev => prev ? { ...prev, status, ...(advice ? { aiRecommendation: advice } : {}) } : null);
      }
    } catch (e: any) {
      showGlobalToast(`Sync failure: ${e.message}`, "error");
      addResilientLog(`ERROR CATCH: Blocked coordinate state modifications.`);
    }
  };

  const handleDeleteClashItem = async (clashId: string) => {
    if (globalPipeline === 'offline') {
      if (offlineClashes.some(c => c.id === clashId)) {
        setOfflineClashes(prev => prev.filter(c => c.id !== clashId));
        showGlobalToast("Offline Cache Cleared: Removed offline-only clash.", "success");
        addResilientLog(`SAFEGUARD DELETE: Purged local offline record ID: ${clashId}`);
        return;
      }
      showGlobalToast("Connection Severed: Cannot delete active cloud records while offline.", "error");
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast("Latency delay active (2.0s)...", "warning");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (confirm("Are you sure you want to remove this clash ticket?")) {
      try {
        if (currentUser && activeProject) {
          await deleteClash(activeProject.id, clashId);
        } else {
          const pId = activeProject?.id || 'demo_olympic_complex';
          setGuestClashesMap(prev => ({
            ...prev,
            [pId]: (prev[pId] || []).filter(c => c.id !== clashId)
          }));
        }
        showGlobalToast("Clash ticket permanently removed from database.", "success");
        addResilientLog(`TRANSMIT: Dispatched purge request for Clash ID: ${clashId}`);
        if (selectedClash?.id === clashId) setSelectedClash(null);
      } catch (e: any) {
        showGlobalToast("Delete failed.", "error");
      }
    }
  };

  const handleAddNewBOQItem = async (fields: any) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'corrupted') {
      showGlobalToast("Quantity parsing blocked: structural schema mismatch.", "error");
      addResilientLog("BLOCKED TRANSACTION: Intercepted corrupt BOQ stream format.");
      return;
    }

    if (globalPipeline === 'offline') {
      const offItem: BOQItem = {
        ...fields,
        id: `offline_boq_${Date.now()}`,
        projectId: pId,
        totalPrice: Number((fields.quantity * fields.unitPrice).toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      setOfflineBOQ(prev => [...prev, offItem]);
      showGlobalToast("Workstation Offline: Saved survey details locally.", "warning");
      addResilientLog(`SAFEGUARD CACHE: Buffered takeoff code [${fields.code}] "${fields.description}" locally.`);
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast("Transmitting takeoff schedule to cloud database... (2.0s delay)", "warning");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await createBOQItem(activeProject.id, fields);
      } else {
        const newItem: BOQItem = {
          ...fields,
          id: `demo_boq_${Date.now()}`,
          projectId: pId,
          totalPrice: Number((fields.quantity * fields.unitPrice).toFixed(2)),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setGuestBOQsMap(prev => ({
          ...prev,
          [pId]: [newItem, ...(prev[pId] || [])]
        }));
      }
      showGlobalToast("Material quantity added to survey log.", "success");
      addResilientLog(`TRANSMIT: Saved takeoff code [${fields.code}] directly to database logs.`);
    } catch (e: any) {
      showGlobalToast("Failed to write survey takeoff.", "error");
    }
  };

  const handleAddNewBCFIssue = async (fields: any) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'offline') {
      const offItem: BCFIssue = {
        ...fields,
        id: `offline_bcf_${Date.now()}`,
        projectId: pId,
        synced: false,
        createdAt: new Date().toISOString()
      };
      setOfflineBCF(prev => [...prev, offItem]);
      showGlobalToast("BCF Gateway Offline: Saved issue locally to local BCF queue.", "warning");
      addResilientLog(`SAFEGUARD CACHE: Cached offline BCF issue "${fields.title}" to local stream.`);
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast("Stalling BCF broadcast server frame...", "warning");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await createBCFIssue(activeProject.id, fields);
      } else {
        const newItem: BCFIssue = {
          ...fields,
          id: `demo_bcf_${Date.now()}`,
          projectId: pId,
          synced: false,
          createdAt: new Date().toISOString()
        };
        setGuestBCFMap(prev => ({
          ...prev,
          [pId]: [newItem, ...(prev[pId] || [])]
        }));
      }
      showGlobalToast("BCF Broadcast recorded successfully.", "success");
      addResilientLog(`TRANSMIT: Broadcasted BCF element ticket "${fields.title}" to standard stream.`);
    } catch (e: any) {
      showGlobalToast("BCF logging failed.", "error");
    }
  };

  const handleDeleteBCFIssue = async (issueId: string) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'offline') {
      if (offlineBCF.some(b => b.id === issueId)) {
        setOfflineBCF(prev => prev.filter(b => b.id !== issueId));
        showGlobalToast("Offline BCF issue removed.", "success");
        addResilientLog(`SAFEGUARD DELETE: Removed offline BCF log ID: ${issueId}`);
        return;
      }
      showGlobalToast("Action Denied: Offline mode disables mutating live BCF cloud records.", "error");
      return;
    }

    if (globalPipeline === 'latency') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await deleteBCFIssue(activeProject.id, issueId);
      } else {
        setGuestBCFMap(prev => ({
          ...prev,
          [pId]: (prev[pId] || []).filter(i => i.id !== issueId)
        }));
      }
      showGlobalToast("BCF issue removed from live gateway.", "success");
      addResilientLog(`TRANSMIT: Dispatched BCF purge signal for ID: ${issueId}`);
    } catch (e: any) {
      showGlobalToast("Delete failed.", "error");
    }
  };

  const handleSyncBCFIssueToClash = async (issue: BCFIssue): Promise<string | null> => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'offline') {
      showGlobalToast("Offline Lock: Dynamic BCF synchronization requires an active CAD link.", "error");
      addResilientLog("BLOCKED SYNC: Intercepted and blocked BCF coordinate sync due to connection drop.");
      return null;
    }

    let sev = ClashSeverity.HIGH;
    const prio = issue.priority.toLowerCase();
    if (prio === 'critical') sev = ClashSeverity.CRITICAL;
    else if (prio === 'high') sev = ClashSeverity.HIGH;
    else if (prio === 'medium') sev = ClashSeverity.MEDIUM;
    else if (prio === 'low') sev = ClashSeverity.LOW;

    try {
      if (currentUser && activeProject) {
        const clashId = await createClash(activeProject.id, {
          title: `[BCF] ${issue.title}`,
          status: ClashStatus.OPEN,
          severity: sev,
          discipline1: issue.discipline1,
          discipline2: issue.discipline2,
          coordinateX: issue.coordinateX,
          coordinateY: issue.coordinateY,
          coordinateZ: issue.coordinateZ,
          assignedTo: issue.assignedTo || 'Unassigned (BCF Sync)',
        });
        if (clashId) {
          await updateBCFIssueSyncState(activeProject.id, issue.id, true, clashId);
          showGlobalToast("BCF issue successfully synced to active 3D CAD model!", "success");
          addResilientLog(`TRANSMIT: Synced BCF Issue "${issue.title}" directly to Clash ID ${clashId}.`);
          return clashId;
        }
      } else {
        showGlobalToast("Sandbox Mode Sync: Synced to local mock coordinator model.", "success");
        return `mock_synced_clash_${Date.now()}`;
      }
      return null;
    } catch (err: any) {
      showGlobalToast(`BCF Sync failed: ${err.message}`, "error");
      return null;
    }
  };

  const handleAddMultipleBOQItems = async (items: any[]) => {
    const pId = activeProject?.id || 'demo_olympic_complex';

    if (globalPipeline === 'offline') {
      const offlineItems = items.map((fields, i) => ({
        ...fields,
        id: `offline_boq_multi_${Date.now()}_${i}`,
        projectId: pId,
        totalPrice: Number((fields.quantity * fields.unitPrice).toFixed(2)),
        createdAt: new Date(),
        updatedAt: new Date()
      }));
      setOfflineBOQ(prev => [...prev, ...offlineItems]);
      showGlobalToast(`Offline Cache Active: Buffered ${items.length} quantities safely on device.`, "warning");
      addResilientLog(`SAFEGUARD BATCH: Transmitted ${items.length} records directly into persistent browser store.`);
      return;
    }

    if (globalPipeline === 'latency') {
      showGlobalToast(`Staging multi-schedule upload (${items.length} rows)...`, "warning");
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await createManyBOQItems(activeProject.id, items);
      }
      showGlobalToast(`Successfully populated ${items.length} materials in database.`, "success");
      addResilientLog(`TRANSMIT: Dispatched material schedule batch totaling ${items.length} items.`);
    } catch (e: any) {
      showGlobalToast("Batch update failed.", "error");
    }
  };

  const handleDeleteBOQTakeoff = async (boqId: string) => {
    if (globalPipeline === 'offline') {
      if (offlineBOQ.some(b => b.id === boqId)) {
        setOfflineBOQ(prev => prev.filter(b => b.id !== boqId));
        showGlobalToast("Offline material quantity removed.", "success");
        addResilientLog(`SAFEGUARD DELETE: Erased cached offline BOQ item: ${boqId}`);
        return;
      }
      showGlobalToast("Action Blocked: Connection lost. Cannot delete active cloud takeoff logs.", "error");
      return;
    }

    if (globalPipeline === 'latency') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    try {
      if (currentUser && activeProject) {
        await deleteBOQItem(activeProject.id, boqId);
      }
      showGlobalToast("Material quantity deleted from central database.", "success");
      addResilientLog(`TRANSMIT: Purged BOQ record ID ${boqId} successfully.`);
    } catch (e: any) {
      showGlobalToast("Removal failed.", "error");
    }
  };

  // Determine current display database items, merged with offline resilient caching lists
  const currentProject = activeProject || (currentUser ? (projectsList[0] || null) : guestProjects[0]) || {
    id: 'demo_olympic_complex',
    name: 'Olympic Transit Hub Terminal 2',
    location: 'Paris, France',
    status: ProjectStatus.ACTIVE,
    ownerId: 'demo_user',
    createdAt: new Date(),
    updatedAt: new Date(),
    coordinates: '48.8566° N, 2.3522° E',
    area: '45,200 m²',
    revision: 'RVT-T2-v4.5'
  };

  const currentClashes = [
    ...(currentUser ? activeClashesList : (guestClashesMap[currentProject.id] || [])),
    ...offlineClashes.filter(c => c.projectId === currentProject.id)
  ];

  const currentBOQ = [
    ...(currentUser ? activeBOQList : (guestBOQsMap[currentProject.id] || [])),
    ...offlineBOQ.filter(b => b.projectId === currentProject.id)
  ];

  const currentBCF = [
    ...(currentUser ? activeBCFIssuesList : (guestBCFMap[currentProject.id] || [])),
    ...offlineBCF.filter(i => i.projectId === currentProject.id)
  ];

  const getProjectCounters = (pId: string) => {
    if (currentUser) {
      if (pId === currentProject.id) {
        const costSum = currentBOQ.reduce((sum, item) => sum + item.totalPrice, 0);
        return { clashes: currentClashes.length, cost: costSum };
      }
      return { clashes: 5, cost: 42000 };
    } else {
      const clashesList = guestClashesMap[pId] || [];
      const boqsList = guestBOQsMap[pId] || [];
      const costSum = boqsList.reduce((sum, item) => sum + item.totalPrice, 0);
      return { clashes: clashesList.length, cost: costSum };
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-[#1a1a1a] flex flex-col font-sans transition-all selection:bg-blue-100 selection:text-blue-900">
      
      {/* 🚀 MAIN HEADER & NAVIGATION PANEL */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 backdrop-blur-md bg-white/95 shadow-none">
        <div className="w-full max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
          
          {/* Logo Brand section */}
          <div className="flex items-center gap-2">
            <div className="bg-gray-900 text-white p-1.5 rounded">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="font-sans font-bold text-xs tracking-tight text-gray-900 uppercase">
                BIM METRIC PORTAL
              </h1>
              <p className="text-[9px] text-gray-405 text-gray-400 font-semibold tracking-wide uppercase">Real-time Spatial Coordination & Automated BOQs</p>
            </div>
          </div>

          {/* Active project selector tab */}
          {currentUser && projectsList.length > 0 && (
            <div className="hidden md:flex items-center gap-1 bg-gray-100 border border-gray-200 rounded p-1 text-xs">
              <span className="text-[9px] text-gray-550 text-gray-500 px-2 font-bold uppercase">ACTIVE:</span>
              <select
                value={activeProject?.id || ''}
                onChange={(e) => {
                  const found = projectsList.find(p => p.id === e.target.value);
                  if (found) setActiveProject(found);
                }}
                className="bg-white hover:bg-gray-50 text-gray-800 font-medium py-0.5 px-1.5 rounded border border-gray-200 outline-none cursor-pointer transition-colors text-[11px]"
              >
                {projectsList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* User profiles & Auth trigger controls */}
          <div className="flex items-center gap-3">
            <button
              id="btn-3d-integration-guide-trigger"
              onClick={() => setShowImportGuide(true)}
              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Show Live 3D Model Connection Steps"
            >
              <HelpCircle className="w-3.5 h-3.5 text-blue-600 animate-pulse" />
              <span className="hidden sm:inline">3D Model Setup Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>
            {isAuthLoading ? (
              <span className="text-[11px] text-gray-400 font-medium select-none">Synchronizing database...</span>
            ) : currentUser ? (
              <div className="flex items-center gap-2.5">
                {/* User avatar and name info */}
                <div className="hidden sm:flex flex-col items-end text-[11px] leading-tight">
                  <span className="font-semibold text-gray-900">{currentUser.displayName || 'Authorized Engineer'}</span>
                  <span className="text-[9px] font-mono text-gray-400">{currentUser.email}</span>
                </div>
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="Avatar" className="w-7 h-7 rounded-full border border-gray-200" referrerPolicy="no-referrer" />
                ) : (
                  <div className="bg-gray-100 p-1.5 rounded-full text-gray-600 border border-gray-200">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <button
                  id="btn-logout"
                  onClick={handleLogout}
                  className="flex items-center gap-1 px-2 py-1 border border-gray-200 rounded hover:bg-gray-50 text-gray-650 text-gray-600 hover:text-gray-900 transition relative text-[11px] cursor-pointer"
                  title="Logout Account"
                >
                  <LogOut className="w-3.5 h-3.5 text-gray-500" />
                  <span className="hidden sm:inline font-semibold">Sign out</span>
                </button>
              </div>
            ) : (
              <button
                id="btn-login"
                onClick={handleLogin}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white rounded text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 text-blue-405 text-blue-400" />
                <span>Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 🚧 CLOUD CONNECTING AND DEMO NOTIFICATION HEAD BANNERS */}
      {authError && (
        <div key="auth-error-banner" className="bg-red-50 border-b border-red-200 py-3 px-4 animate-in slide-in-from-top duration-300">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[11px] text-red-950 relative">
            <div className="flex items-start gap-2.5">
              <div className="bg-red-100 p-1.5 rounded-full text-red-650 mt-0.5 flex-shrink-0">
                <ShieldAlert className="w-4 h-4 animate-pulse text-red-600" />
              </div>
              <div className="flex-1">
                <span className="font-extrabold uppercase tracking-widest text-red-700 block mb-0.5">
                  Sign-In Intercepted ({authError.code})
                </span>
                <p className="text-red-900 leading-relaxed font-semibold">
                  Google login window failed to complete. When opened inside a cross-origin preview frame (like AI Studio's side pane), browsers often block authentication popups or restrict third-party database credentials.
                </p>
                <div className="mt-2 flex flex-col gap-1 md:flex-row md:items-center md:gap-4 text-[9.5px]">
                  <span className="bg-white border border-red-100 px-2 py-0.5 rounded text-red-800 font-bold flex items-center gap-1 shadow-xs">
                    💡 Solution 1: Click the "Open in New Tab" icon at the top-right corner of AI Studio and sign in there!
                  </span>
                  <span className="bg-white border border-red-100 px-2 py-0.5 rounded text-red-800 font-bold flex items-center gap-1 shadow-xs">
                    💡 Solution 2: Enable popups/cookies in your browser settings.
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 mt-2 md:mt-0">
              <button
                id="btn-login-error-retry"
                onClick={handleLogin}
                className="text-[9px] bg-red-600 hover:bg-red-700 text-white border border-red-650 rounded font-black uppercase tracking-wider px-2.5 py-1.5 transition cursor-pointer"
              >
                Retry Sign-In
              </button>
              <button
                id="btn-login-error-dismiss"
                onClick={() => setAuthError(null)}
                className="text-[9px] bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded font-bold uppercase tracking-wider px-2 py-1.5 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {!currentUser && !isAuthLoading && !authError && (
        <div className="bg-amber-50 border-b border-amber-200 py-1.5 px-4 animate-in fade-in">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px] text-amber-900">
            <span className="flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-amber-600" />
              <span>Viewing in <strong className="font-semibold">Interactive Sandbox Mode</strong>. Connect your Google account to manage private projects, configure models and save live BIM modifications.</span>
            </span>
            <button
              onClick={handleLogin}
              className="text-[10px] bg-amber-500/10 text-amber-950 border border-amber-200 rounded py-0.5 px-2 hover:bg-amber-500/20 transition-all uppercase tracking-wider font-bold cursor-pointer"
            >
              Sign up free
            </button>
          </div>
        </div>
      )}

      {/* 🗺️ INTERACTIVE MAIN CONTENT VIEWS */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 flex flex-col gap-4">

        {/* 🛡️ RESILIENT SYSTEM TOASTER CO-ORDINATOR */}
        {globalToast && (
          <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom duration-300">
            <div className={`p-4 rounded shadow-xl border flex items-start gap-3 max-w-sm ${
              globalToast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
              globalToast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
              globalToast.type === 'error' ? 'bg-red-50 border-red-200 text-red-900' :
              'bg-blue-50 border-blue-200 text-blue-900'
            }`}>
              <div className="mt-0.5">
                {globalToast.type === 'success' && <Wifi className="w-5 h-5 text-emerald-600" />}
                {globalToast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                {globalToast.type === 'error' && <ServerCrash className="w-5 h-5 text-red-650" />}
                {globalToast.type === 'info' && <RefreshCw className="w-5 h-5 text-blue-650 animate-spin" />}
              </div>
              <div className="flex-1 text-[11px]">
                <p className="font-bold uppercase tracking-wide leading-none">
                  {globalToast.type === 'success' && 'Transaction Sync Live'}
                  {globalToast.type === 'warning' && 'Failover Interception'}
                  {globalToast.type === 'error' && 'Critical Trace Caught'}
                  {globalToast.type === 'info' && 'Handshake In Progress'}
                </p>
                <p className="mt-1 font-medium text-opacity-90">{globalToast.text}</p>
              </div>
              <button 
                onClick={() => setGlobalToast(null)}
                className="text-[11px] font-bold hover:text-gray-900 opacity-60 hover:opacity-100 cursor-pointer text-gray-500"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 🛡️ HIGH-AVAILABILITY CLOUD RESILIENCY & EXCEPTION INTERCEPT PORTAL */}
        <div className="bg-white rounded border border-gray-200 p-4 shadow-none flex flex-col gap-4 animate-in fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 text-slate-100 rounded">
                <ShieldAlert className="w-4 h-4 text-amber-500 animate-pulse" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-xs uppercase text-gray-900 tracking-wider">
                  Industrial Resiliency Control Board
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                  Fail-Safe Interception Gateways & Workstation Error Injection
                </p>
              </div>
            </div>

            {/* Hardware-level socket tracker link */}
            <div className="flex items-center gap-3 text-[10px] sm:self-center font-bold font-mono">
              <span className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-gray-600">
                <Activity className="w-3.5 h-3.5 text-blue-500" />
                <span>Socket Latency: {globalPipeline === 'latency' ? '2034ms' : '11ms'}</span>
              </span>
              <span className={`flex items-center gap-1 px-2.5 py-1 rounded border uppercase ${
                browserOnline && globalPipeline !== 'offline'
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-700'
                  : 'bg-red-50 border-red-200 text-red-700 font-bold animate-pulse'
              }`}>
                {browserOnline && globalPipeline !== 'offline' ? (
                  <>
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" /> Link: Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-red-600" /> Link: Severed
                  </>
                )}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            
            {/* Mode selection columns */}
            <div className="md:col-span-8 flex flex-col gap-2.5">
              <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                1. SELECT FAULT-TOLERANT SIMULATION MODE:
              </span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                
                {/* Mode 1: Healthy */}
                <button
                  onClick={() => {
                    setGlobalPipeline('healthy');
                    showGlobalToast("Central Pipeline Gateway: Synchronisation lock verified.", "success");
                    addResilientLog("USER: Restated CORE_STABLE High-Throughput online state.");
                  }}
                  className={`p-3 text-left rounded border flex flex-col justify-between transition-all cursor-pointer h-[84px] ${
                    globalPipeline === 'healthy'
                      ? 'bg-emerald-50/70 border-emerald-550 ring-1 ring-emerald-500 text-emerald-955'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`w-2 h-2 rounded-full ${globalPipeline === 'healthy' ? 'bg-emerald-500 animate-ping' : 'bg-gray-300'}`} />
                    <Wifi className={`w-3.5 h-3.5 ${globalPipeline === 'healthy' ? 'text-emerald-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] leading-tight text-gray-900 uppercase">Healthy Sync</h4>
                    <span className="text-[9px] text-gray-500">Live DB Writes (12ms)</span>
                  </div>
                </button>

                {/* Mode 2: Latency block */}
                <button
                  onClick={() => {
                    setGlobalPipeline('latency');
                    showGlobalToast("Latency Injection: Artificial 2000ms delay active.", "warning");
                    addResilientLog("USER: Injected core VPN brownout latency simulated delay (+2.0s).");
                  }}
                  className={`p-3 text-left rounded border flex flex-col justify-between transition-all cursor-pointer h-[84px] ${
                    globalPipeline === 'latency'
                      ? 'bg-amber-50/70 border-amber-550 ring-1 ring-amber-500 text-amber-955'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <Activity className={`w-3.5 h-3.5 ${globalPipeline === 'latency' ? 'text-amber-600 animate-bounce' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] leading-tight text-gray-900 uppercase">Latency Delay</h4>
                    <p className="text-[9px] text-gray-500">Delayed Pipeline Stalls</p>
                  </div>
                </button>

                {/* Mode 3: Offline mode */}
                <button
                  onClick={() => {
                    setGlobalPipeline('offline');
                    showGlobalToast("Revit Terminal Crashed: Offline local safeguarding active.", "error");
                    addResilientLog("USER: Force-disrupted the Revit telemetry pipeline (Workstation drop).");
                  }}
                  className={`p-3 text-left rounded border flex flex-col justify-between transition-all cursor-pointer h-[84px] ${
                    globalPipeline === 'offline'
                      ? 'bg-red-50/70 border-red-550 ring-1 ring-red-500 text-red-955'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <ServerCrash className={`w-3.5 h-3.5 ${globalPipeline === 'offline' ? 'text-red-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] leading-tight text-gray-900 uppercase">Revit Crash</h4>
                    <p className="text-[9px] text-gray-500">Local-only Cache Active</p>
                  </div>
                </button>

                {/* Mode 4: Corrupted checks */}
                <button
                  onClick={() => {
                    setGlobalPipeline('corrupted');
                    showGlobalToast("Data integrity filters active. Preventing schema pollution.", "info");
                    addResilientLog("USER: Saturated stream with raw corrupted JSON syntax signatures.");
                  }}
                  className={`p-3 text-left rounded border flex flex-col justify-between transition-all cursor-pointer h-[84px] ${
                    globalPipeline === 'corrupted'
                      ? 'bg-fuchsia-50/70 border-fuchsia-550 ring-1 ring-fuchsia-500 text-fuchsia-955'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
                    <FileWarning className={`w-3.5 h-3.5 ${globalPipeline === 'corrupted' ? 'text-fuchsia-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-[11px] leading-tight text-gray-900 uppercase">Corrupt Test</h4>
                    <p className="text-[9px] text-gray-500">Format Signature Block</p>
                  </div>
                </button>

              </div>

              {/* Offline buffer sync status bar */}
              {(offlineClashes.length > 0 || offlineBOQ.length > 0 || offlineBCF.length > 0) && (
                <div className="bg-amber-50 border border-amber-200 p-2.5 rounded flex items-center justify-between gap-3 text-[11px] animate-in slide-in-from-top-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
                    <span className="text-amber-900 font-semibold">
                      Workstation buffered <strong className="font-bold">{offlineClashes.length} clashes, {offlineBOQ.length} quantities, and {offlineBCF.length} BCF events</strong> inside browser safe vault.
                    </span>
                  </div>
                  <button
                    onClick={handleRecoverAndSync}
                    className="bg-amber-650 hover:bg-amber-700 bg-amber-600 text-white font-bold py-1 px-3 rounded uppercase tracking-wider text-[10px] cursor-pointer"
                  >
                    Resync Cache
                  </button>
                </div>
              )}
            </div>

            {/* Live trace logs column */}
            <div className="md:col-span-4 flex flex-col gap-2.5 w-full">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider">
                  2. LIVE TELEMETRY STREAM LOGS:
                </span>
                <button
                  onClick={() => setResilientActionLogs([])}
                  className="text-[9px] font-bold text-gray-400 hover:text-gray-600 uppercase cursor-pointer"
                >
                  Clear Buffer
                </button>
              </div>
              <div className="bg-[#121820] text-[#00ff66] font-mono p-3 rounded text-[9px] h-[84px] overflow-y-auto leading-normal border border-slate-800">
                {resilientActionLogs.length === 0 ? (
                  <div className="text-gray-500 italic text-center py-4">[Event bus clean] No traces recorded.</div>
                ) : (
                  resilientActionLogs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap">{log}</div>
                  ))
                ).reverse()}
              </div>
            </div>
          </div>
        </div>

        {/* 🏢 PORTFOLIO COG: ACTIVE BIM WORKSPACE MULTI-SITE NAVIGATOR */}
        <div className="bg-white rounded border border-gray-200 p-4 shadow-none flex flex-col gap-3.5">
          <div>
            <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider block">Connected BIM Sites Portfolio</span>
            <h2 className="font-sans font-bold text-base text-gray-900">BIM Workspace Site Navigator</h2>
            <p className="text-[11px] text-gray-550 leading-relaxed mt-0.5">
              Click any active workspace node below to reload 3D drawing coordinates, collaboration notes, and cost takeoff schedules instantly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-1">
            {projectsList.map((p) => {
              const isActive = p.id === currentProject.id;
              const { clashes, cost } = getProjectCounters(p.id);

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    setActiveProject(p);
                    showGlobalToast(`Hot-swapped CAD workspace to: ${p.name}`, "info");
                    addResilientLog(`HOTSWAP: Hot-swapped active drawing coordinates to workspace state "${p.name}".`);
                  }}
                  className={`relative p-3.5 rounded border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[142px] hover:-translate-y-0.5 select-none ${
                    isActive
                      ? "bg-slate-50/50 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                      : "bg-white border-gray-200 hover:border-gray-350 hover:bg-gray-50/30"
                  }`}
                >
                  {/* Active Indicator Sparkle */}
                  {isActive && (
                    <span className="absolute top-3.5 right-3.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                    </span>
                  )}

                  <div>
                    {/* Header Site Details */}
                    <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-bold uppercase tracking-wide">
                      <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                      <span className="truncate">{p.location}</span>
                    </div>

                    <h4 className="font-sans font-bold text-[13px] text-gray-900 leading-snug mt-1.5 truncate">
                      {p.name}
                    </h4>

                    {/* Meta coordinates tag details */}
                    <div className="flex flex-col gap-0.5 text-[10px] text-gray-500 font-medium mt-1.5">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold">WGS84:</span>
                        <span className="text-gray-700">{p.coordinates || "WGS-48.8566, 2.3522"}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-400 font-bold">Spec:</span>
                        <span className="text-gray-700">
                          {p.area || "45,200 m²"} ({p.revision || "RVT-Rev4.5"})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Counters */}
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-3 text-[11px] font-bold text-gray-600">
                    <div className="flex items-center gap-1">
                      <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${clashes > 0 ? "text-amber-500" : "text-gray-400"}`} />
                      <span>{clashes} Clashes</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-950">
                      <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>${cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Est.</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Dash placeholder to instantiate a new Connected Site Workspace */}
            <button
              onClick={() => setShowAddProject(true)}
              className="border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/5 hover:text-blue-600 rounded p-4 text-center transition flex flex-col items-center justify-center gap-1.5 min-h-[142px] text-gray-500 group cursor-pointer"
            >
              <div className="p-2 rounded bg-gray-50 group-hover:bg-blue-50 text-gray-400 group-hover:text-blue-500 transition">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider">Connect Private Site</span>
              <span className="text-[10px] text-gray-400 group-hover:text-blue-500/80 leading-normal max-w-[180px]">
                Create new model node & stream spatial boundaries
              </span>
            </button>
          </div>
        </div>

        {/* 🔌 3D MODEL INTEGRATION & AUTHORING CONNECTION GUIDE POPUP */}
        {showImportGuide && (
          <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-400 animate-pulse" />
                  <div>
                    <h3 className="font-sans font-bold text-sm uppercase tracking-wider">
                      3D Model Link & CAD Integration Guild
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold font-sans">
                      Connect Revit, AutoCAD, Dynamo or Rhino models directly to Phase 2
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportGuide(false)}
                  className="text-gray-400 hover:text-white transition cursor-pointer text-sm p-1"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-5 overflow-y-auto space-y-5 text-left text-xs text-gray-700 leading-normal">
                
                {/* Intro Section */}
                <div className="bg-blue-50/70 border border-blue-150 p-3.5 rounded text-[11px] text-blue-950 flex items-start gap-2.5">
                  <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block text-blue-900 mb-1">How Phase 02 (BIM Space) Visualizes the Model</strong>
                    To maintain speed and avoid downloading multi-gigabyte heavy model files, this platform utilizes a highly optimized coordinate vector translator. Rather than downloading physical files, we continuously synchronize lightweight **drawing coordinates, systems layering, and material definitions** directly.
                  </div>
                </div>

                {/* Step Strategy */}
                <div>
                  <h4 className="font-sans font-extrabold text-[11px] uppercase text-gray-900 tracking-wider mb-3 flex items-center gap-1.5 pb-1 border-b border-gray-100">
                    <Layers className="w-4 h-4 text-slate-700" />
                    Step-by-Step Connection Instructions
                  </h4>
                  
                  <div className="space-y-4 font-semibold">
                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 font-mono">1</span>
                      <div>
                        <h5 className="font-bold text-gray-900 leading-tight">Extract drawings/geometry schedules in your CAD</h5>
                        <p className="text-gray-500 font-normal mt-0.5">
                          Inside Revit or AutoCAD, generate a list of drawing names or material quantity schedules. This file holds the spatial designations, drawing names, and structural code types.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 font-mono">2</span>
                      <div>
                        <h5 className="font-bold text-gray-900 leading-tight">Format or standardized with Gemini AI (Phase 01)</h5>
                        <p className="text-gray-500 font-normal mt-0.5">
                          Switch active tab to <strong className="font-bold text-gray-950 hover:underline cursor-pointer" onClick={() => { setActiveTab('sheets-portal'); setShowImportGuide(false); }}>Phase 01: ISO-19650 Drawings Registry</strong>. In the staging area, paste your Revit Drawing lists or click **"Revit Core Schedule"** preset, then submit. The integrated Gemini model interprets and constructs standardized metadata layers instantly.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 font-mono">3</span>
                      <div>
                        <h5 className="font-bold text-gray-900 leading-tight">Visualize & Rotate 3D components interactively (Phase 02)</h5>
                        <p className="text-gray-500 font-normal mt-0.5">
                          Once standardized, go to <strong className="font-bold text-gray-950 hover:underline cursor-pointer" onClick={() => { setActiveTab('coordination'); setShowImportGuide(false); }}>Phase 02: BIM Model & Coordination</strong>. The coordinate paths will automatically draw the 3D structures. Toggle to <strong>3D ISO view</strong>, and use the new <strong>Rotate Left/Right (↺/↻)</strong> buttons in the canvas toolbar to spin the model dynamics by 15° steps as needed!
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-3">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 font-mono">4</span>
                      <div>
                        <h5 className="font-bold text-gray-900 leading-tight">Extract 5D Takeoff quantities or drop annotation pins</h5>
                        <p className="text-gray-500 font-normal mt-0.5">
                          On the interactive canvas, click on any component to inspect physical properties or drop pins to coordinate with your coworkers instantly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Automation Scripts block */}
                <div className="bg-slate-950 rounded p-4 border border-slate-900 text-[11px] text-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      Dynamic Automation (Dynamo/Python)
                    </span>
                    <span className="text-slate-450 text-[9px] font-mono">Standard POST endpoint</span>
                  </div>
                  
                  <p className="text-slate-350 text-[10px] mb-3 leading-relaxed">
                    Rather than manually uploading spreadsheets, configure your localized **Dynamo** (for Revit) or **Grasshopper** script to push directly to our central webhook endpoint on document save:
                  </p>

                  <div className="bg-slate-900 p-2.5 rounded font-mono text-[9.5px] text-[#00ff66] break-all border border-slate-800 leading-normal">
                    curl -X POST "{window.location.origin}/api/sheets/webhook" \<br />
                    &nbsp;&nbsp;-H "Authorization: Bearer tok_bim_standard" \<br />
                    &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                    &nbsp;&nbsp;-d '&#123;<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;"projectDescription": "Live Revit Model Save Update",<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;"drawingLines": ["S-101_Level_1.dwg", "M-301_HVAC_Ductwork.rvt"]<br />
                    &nbsp;&nbsp;&#125;'
                  </div>
                  
                  <div className="flex items-center justify-between mt-3 text-[9.5px] text-slate-400 bg-slate-900/60 p-2 rounded">
                    <span>💡 <strong>Tip:</strong> Copy specific tokens & custom client examples inside the <strong>Phase 01 Sheets Registry</strong> bottom panel.</span>
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="bg-gray-50 p-3.5 border-t border-gray-150 flex justify-end gap-2 text-[10px] font-bold uppercase tracking-wider">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('sheets-portal');
                    setShowImportGuide(false);
                  }}
                  className="px-3.5 py-1.5 bg-white border border-gray-200 rounded text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Go to Phase 1 Setup
                </button>
                <button
                  type="button"
                  onClick={() => setShowImportGuide(false)}
                  className="px-4 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 cursor-pointer"
                >
                  Understood
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Create Project Modal/Drawer Dialog */}
        {showAddProject && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded max-w-md w-full shadow-xl border border-gray-200 p-5 animate-in zoom-in-95 duration-200">
              <h3 className="font-sans font-bold text-sm text-gray-900 mb-1 flex items-center gap-1.5 uppercase tracking-tight">
                <Briefcase className="w-4 h-4 text-blue-600" />
                Initialize Connected BIM Project
              </h3>
              <p className="text-[11px] text-gray-550 mb-4 leading-normal">
                Set up a new isolated workspace. We'll automatically seed it with sample 3D geometric coordinates and quantities you can modify or delete.
              </p>

              <form onSubmit={handleCreateNewProject} className="space-y-3 font-semibold text-[11px]">
                <div>
                  <label className="block text-gray-650 font-bold uppercase mb-1 text-[9px] tracking-wider">Project Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Skyline Skyscraper Phase A"
                    value={newProjectForm.name}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, name: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-gray-900 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-gray-650 font-bold uppercase mb-1 text-[9px] tracking-wider">Site Location / City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. San Francisco, California"
                    value={newProjectForm.location}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, location: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-gray-900 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-650 font-bold uppercase mb-1 text-[9px] tracking-wider">GPS Coordinates</label>
                    <input
                      type="text"
                      placeholder="e.g. 37.7749° N, 122.4194° W"
                      value={newProjectForm.coordinates}
                      onChange={(e) => setNewProjectForm({ ...newProjectForm, coordinates: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-gray-900 text-xs text-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-650 font-bold uppercase mb-1 text-[9px] tracking-wider">Site Total Area</label>
                    <input
                      type="text"
                      placeholder="e.g. 52,000 m²"
                      value={newProjectForm.area}
                      onChange={(e) => setNewProjectForm({ ...newProjectForm, area: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-gray-900 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-gray-650 font-bold uppercase mb-1 text-[9px] tracking-wider">Revit (RVT) CAD Revision code</label>
                  <input
                    type="text"
                    placeholder="e.g. RVT-v2.1"
                    value={newProjectForm.revision}
                    onChange={(e) => setNewProjectForm({ ...newProjectForm, revision: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded p-2 text-gray-900 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 text-[11px] font-bold uppercase tracking-wider">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProject(false);
                      setNewProjectForm({ name: '', location: '', coordinates: '', area: '', revision: '' });
                    }}
                    className="px-3 py-1.5 border border-gray-250 rounded text-gray-600 hover:bg-gray-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingProject}
                    className="px-4 py-1.5 bg-gray-950 hover:bg-gray-850 disabled:bg-gray-250 disabled:text-gray-400 text-white rounded transition cursor-pointer"
                  >
                    {isCreatingProject ? 'Pre-loading models...' : 'Create Workspace'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 📊 CUSTOMIZABLE METRIC PERFORMANCE DASHBOARD */}
        <MetricDashboard clashes={currentClashes} boqItems={currentBOQ} />

        {/* 📑 PROCESS-DRIVEN MULTI-PHASE WORKFLOW TANK */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2 px-1 select-none text-[10px]">
            <span className="uppercase font-extrabold tracking-widest text-[#2563eb] bg-[#eff6ff] px-2.5 py-0.5 rounded border border-[#dbeafe] flex items-center gap-1.5 self-start font-sans">
              <Activity className="w-3.5 h-3.5 text-blue-505 text-blue-500 animate-pulse" />
              Standard AEC Project Lifecycle Workflow
            </span>
            <span className="text-gray-400 font-medium font-sans">
              Follow step-by-step from Design Standardization to final Cost Quantity survey
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white p-1 rounded border border-gray-200 gap-1.5 shadow-xs items-stretch">
            {/* Step 1: Design Sheets Stage */}
            <button
              id="tab-btn-sheets-portal"
              onClick={() => setActiveTab('sheets-portal')}
              className={`text-left px-3.5 py-2.5 rounded transition flex flex-col justify-between cursor-pointer border ${
                activeTab === 'sheets-portal'
                  ? 'bg-emerald-50/50 border-emerald-255 border-emerald-200 text-emerald-950 font-extrabold shadow-xs'
                  : 'bg-white border-transparent text-gray-500 hover:text-gray-850 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[8.5px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'sheets-portal' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>Phase 01</span>
                <span className="text-[8.5px] uppercase font-bold text-gray-400 tracking-wider font-sans select-none">Schema Setup</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <FileSpreadsheet className={`w-4 h-4 shrink-0 ${activeTab === 'sheets-portal' ? 'text-emerald-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <h4 className="text-[11px] font-bold tracking-tight truncate leading-tight">ISO-19650 Drawings Registry</h4>
                  <p className="text-[9px] text-gray-400 truncate font-normal">Design Staging & Code Audit</p>
                </div>
              </div>
            </button>

            {/* Step 2: 3D BIM Model Coordination */}
            <button
              id="tab-btn-coordination"
              onClick={() => setActiveTab('coordination')}
              className={`text-left px-3.5 py-2.5 rounded transition flex flex-col justify-between cursor-pointer border ${
                activeTab === 'coordination'
                  ? 'bg-blue-50/50 border-blue-255 border-blue-200 text-blue-950 font-extrabold shadow-xs'
                  : 'bg-white border-transparent text-gray-500 hover:text-gray-850 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[8.5px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'coordination' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>Phase 02</span>
                <span className="text-red-500 text-[8.5px] font-extrabold py-0.2 px-1.5 rounded bg-red-50 ml-1 font-sans border border-red-100 select-none">
                  {currentClashes.filter(c => c.status !== ClashStatus.RESOLVED).length} Clashes
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Compass className={`w-4 h-4 shrink-0 ${activeTab === 'coordination' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <h4 className="text-[11px] font-bold tracking-tight truncate leading-tight">BIM Model & Coordination</h4>
                  <p className="text-[9px] text-gray-400 truncate font-normal">3D Interference & Clashes</p>
                </div>
              </div>
            </button>

            {/* Step 3: BCF Issue Coordination Stream */}
            <button
              id="tab-btn-bcf-feed"
              onClick={() => setActiveTab('bcf-feed')}
              className={`text-left px-3.5 py-2.5 rounded transition flex flex-col justify-between cursor-pointer border ${
                activeTab === 'bcf-feed'
                  ? 'bg-amber-50/50 border-amber-255 border-amber-200 text-amber-950 font-extrabold shadow-xs'
                  : 'bg-white border-transparent text-gray-500 hover:text-gray-850 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[8.5px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'bcf-feed' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>Phase 03</span>
                <span className="bg-amber-100 border border-amber-200 text-amber-800 text-[8.5px] font-bold py-0.2 px-1.5 rounded font-sans select-none">
                  {currentBCF.filter(i => !i.synced).length} Unsynced
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <FileCheck2 className={`w-4 h-4 shrink-0 ${activeTab === 'bcf-feed' ? 'text-amber-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <h4 className="text-[11px] font-bold tracking-tight truncate leading-tight">Live BCF Issue Feed</h4>
                  <p className="text-[9px] text-gray-400 truncate font-normal">Collaborative XML/JSON stream</p>
                </div>
              </div>
            </button>

            {/* Step 4: Cost Quantification & Takeoffs */}
            <button
              id="tab-btn-takeoffs"
              onClick={() => setActiveTab('takeoffs')}
              className={`text-left px-3.5 py-2.5 rounded transition flex flex-col justify-between cursor-pointer border ${
                activeTab === 'takeoffs'
                  ? 'bg-indigo-50/50 border-indigo-255 border-indigo-200 text-indigo-950 font-extrabold shadow-xs'
                  : 'bg-white border-transparent text-gray-500 hover:text-gray-850 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className={`text-[8.5px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded font-extrabold ${activeTab === 'takeoffs' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-500'}`}>Phase 04</span>
                <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 text-[8.5px] font-bold py-0.2 px-1.5 rounded font-mono select-none border-dashed">
                  ${(currentBOQ.reduce((sum, item) => sum + item.totalPrice, 0) / 1000).toFixed(0)}k Est.
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Calculator className={`w-4 h-4 shrink-0 ${activeTab === 'takeoffs' ? 'text-indigo-600' : 'text-gray-400'}`} />
                <div className="min-w-0">
                  <h4 className="text-[11px] font-bold tracking-tight truncate leading-tight">Automated Takeoffs (BOQs)</h4>
                  <p className="text-[9px] text-gray-400 truncate font-normal">Model quantity survey & estimate</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* VIEWPORTS EXPANSIONS */}
        <div className="flex-1 min-h-[500px]">
          
          {/* TAB 1: COORDINATIONS (BIM GRAPHICS + ISSUE TRACKER) */}
          {activeTab === 'coordination' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start animate-in fade-in duration-200">
              
              {/* BIM Visualizer core column (12 columns for cooperative splitting) */}
              <div className="xl:col-span-12 min-h-[500px]">
                <BIMViewer
                  projectId={currentProject.id}
                  currentUser={currentUser}
                  clashes={currentClashes}
                  selectedClash={selectedClash}
                  onSelectClash={setSelectedClash}
                  filteredDisciplines={filteredDisciplines}
                  setFilteredDisciplines={setFilteredDisciplines}
                />
              </div>

              {/* Clash listing & AI advisors column */}
              <div className="xl:col-span-12">
                <ClashManager
                  clashes={currentClashes}
                  selectedClash={selectedClash}
                  onSelectClash={setSelectedClash}
                  onUpdateClashStatus={handleUpdateClash}
                  onDeleteClash={handleDeleteClashItem}
                  onAddClash={handleAddNewClash}
                />
              </div>
            </div>
          )}

          {/* TAB 2: QUANTITY TAKE-OFF SURVEYING TABLE */}
          {activeTab === 'takeoffs' && (
            <div className="animate-in fade-in duration-350">
              <QuantitySurveyor
                items={currentBOQ}
                onAddBOQItem={handleAddNewBOQItem}
                onAddManyBOQItems={handleAddMultipleBOQItems}
                onDeleteBOQItem={handleDeleteBOQTakeoff}
                projectLocation={currentProject.location}
              />
            </div>
          )}

          {/* TAB 3: BCF INCOMING COORDINATION TRACKER FEED */}
          {activeTab === 'bcf-feed' && (
            <div className="animate-in fade-in duration-350">
              <BCFIssueTracker
                projectId={currentProject.id}
                bcfIssues={currentBCF}
                onAddBCFIssueToFeed={handleAddNewBCFIssue}
                onDeleteBCFIssue={handleDeleteBCFIssue}
                onSyncIssueToClash={handleSyncBCFIssueToClash}
              />
            </div>
          )}

          {/* TAB 4: AUTOMATED SHEET PORTAL NAMER */}
          {activeTab === 'sheets-portal' && (
            <div className="animate-in fade-in duration-350">
              <SheetsPortal projectId={currentProject.id} />
            </div>
          )}
        </div>
      </main>

      {/* 💎 DESIGN CREDITS OR INFRASTRUCTURE STATS */}
      <footer className="bg-white border-t border-gray-200 py-3 text-[11px] text-gray-550 text-gray-500 select-none">
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <span>© 2026 Metric Construction Portal.</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-medium text-gray-500">
            <span className="flex items-center gap-1 bg-gray-50 py-0.5 px-2 rounded border border-gray-200">
              <Database className="w-3 h-3 text-blue-500" />
              <span>Firestore Connected</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
