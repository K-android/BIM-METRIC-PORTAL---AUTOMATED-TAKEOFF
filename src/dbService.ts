import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Project, Clash, BOQItem, ProjectStatus, ClashStatus, ClashSeverity, Annotation, UserPresence, BCFIssue } from './types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// -----------------------------------------
// PROJECTS SERVICES
// -----------------------------------------

export const createProject = async (name: string, location: string): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error("User must be authenticated.");

  const path = 'projects';
  const projectId = `project_${Date.now()}`;
  try {
    const projectData: Project = {
      id: projectId,
      name,
      location,
      status: ProjectStatus.ACTIVE,
      ownerId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, path, projectId), projectData);
    return projectId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${path}/${projectId}`);
    return '';
  }
};

export const updateProjectStatus = async (projectId: string, status: ProjectStatus): Promise<void> => {
  const path = `projects/${projectId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId), {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const path = `projects/${projectId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToMyProjects = (onUpdate: (projects: Project[]) => void, onError?: (err: Error) => void) => {
  const user = auth.currentUser;
  if (!user) {
    onUpdate([]);
    return () => {};
  }

  const path = 'projects';
  const q = query(
    collection(db, path),
    where("ownerId", "==", user.uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const projects: Project[] = [];
    snapshot.forEach((d) => {
      projects.push(d.data() as Project);
    });
    onUpdate(projects);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};

// -----------------------------------------
// CLASHES SERVICES
// -----------------------------------------

export const createClash = async (
  projectId: string,
  fields: Omit<Clash, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'aiRecommendation'>
): Promise<string> => {
  const clashId = `clash_${Date.now()}`;
  const path = `projects/${projectId}/clashes/${clashId}`;
  try {
    const clashData: Clash = {
      ...fields,
      id: clashId,
      projectId,
      aiRecommendation: 'Click on the "Generate Advisor Guidelines" option below to invoke structural model resolution via Gemini AI.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'projects', projectId, 'clashes', clashId), clashData);
    return clashId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
};

export const updateClashStatus = async (
  projectId: string,
  clashId: string,
  status: ClashStatus,
  aiRecommendation?: string
): Promise<void> => {
  const path = `projects/${projectId}/clashes/${clashId}`;
  try {
    const updateObj: Record<string, any> = {
      status,
      updatedAt: serverTimestamp()
    };
    if (aiRecommendation !== undefined) {
      updateObj.aiRecommendation = aiRecommendation;
    }
    await updateDoc(doc(db, 'projects', projectId, 'clashes', clashId), updateObj);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteClash = async (projectId: string, clashId: string): Promise<void> => {
  const path = `projects/${projectId}/clashes/${clashId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'clashes', clashId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToClashes = (
  projectId: string,
  onUpdate: (clashes: Clash[]) => void,
  onError?: (err: Error) => void
) => {
  const path = `projects/${projectId}/clashes`;
  const q = query(
    collection(db, 'projects', projectId, 'clashes'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const clashes: Clash[] = [];
    snapshot.forEach((d) => {
      clashes.push(d.data() as Clash);
    });
    onUpdate(clashes);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};

// -----------------------------------------
// BOQ ITEMS SERVICES
// -----------------------------------------

export const createBOQItem = async (
  projectId: string,
  fields: Omit<BOQItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'totalPrice'>
): Promise<string> => {
  const boqItemId = `boq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `projects/${projectId}/boqItems/${boqItemId}`;
  try {
    const totalPrice = Number((fields.quantity * fields.unitPrice).toFixed(2));
    const carbonIntensity = fields.carbonIntensity || 0;
    const totalCarbon = Number((fields.quantity * carbonIntensity).toFixed(2));
    
    const boqData: BOQItem = {
      ...fields,
      id: boqItemId,
      projectId,
      totalPrice,
      totalCarbon,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(doc(db, 'projects', projectId, 'boqItems', boqItemId), boqData);
    return boqItemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
};

export const createManyBOQItems = async (
  projectId: string,
  items: Omit<BOQItem, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'totalPrice'>[]
): Promise<void> => {
  for (const item of items) {
    await createBOQItem(projectId, item);
  }
};

export const updateBOQItem = async (
  projectId: string,
  boqItemId: string,
  quantity: number,
  unitPrice: number,
  notes: string
): Promise<void> => {
  const path = `projects/${projectId}/boqItems/${boqItemId}`;
  try {
    const totalPrice = Number((quantity * unitPrice).toFixed(2));
    await updateDoc(doc(db, 'projects', projectId, 'boqItems', boqItemId), {
      quantity,
      unitPrice,
      totalPrice,
      notes,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const deleteBOQItem = async (projectId: string, boqItemId: string): Promise<void> => {
  const path = `projects/${projectId}/boqItems/${boqItemId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'boqItems', boqItemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToBOQItems = (
  projectId: string,
  onUpdate: (items: BOQItem[]) => void,
  onError?: (err: Error) => void
) => {
  const path = `projects/${projectId}/boqItems`;
  const q = query(
    collection(db, 'projects', projectId, 'boqItems'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const items: BOQItem[] = [];
    snapshot.forEach((d) => {
      items.push(d.data() as BOQItem);
    });
    onUpdate(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};

// CREATE ANNOTATION
export const createAnnotation = async (projectId: string, fields: Omit<Annotation, 'id' | 'createdAt'>): Promise<string | null> => {
  const path = `projects/${projectId}/annotations`;
  try {
    const colRef = collection(db, 'projects', projectId, 'annotations');
    const docRef = doc(colRef);
    const id = docRef.id;
    const annotationData: Annotation = {
      ...fields,
      id,
      createdAt: serverTimestamp()
    };
    await setDoc(docRef, annotationData);
    return id;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }
};

// DELETE ANNOTATION
export const deleteAnnotation = async (projectId: string, annotationId: string): Promise<boolean> => {
  const path = `projects/${projectId}/annotations/${annotationId}`;
  try {
    const docRef = doc(db, 'projects', projectId, 'annotations', annotationId);
    await deleteDoc(docRef);
    return true;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

// LISTEN TO ANNOTATIONS
export const listenToAnnotations = (
  projectId: string,
  onUpdate: (annotations: Annotation[]) => void,
  onError?: (err: Error) => void
) => {
  const path = `projects/${projectId}/annotations`;
  const q = query(
    collection(db, 'projects', projectId, 'annotations'),
    orderBy('createdAt', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const annotations: Annotation[] = [];
    snapshot.forEach((d) => {
      annotations.push(d.data() as Annotation);
    });
    onUpdate(annotations);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};

// UPDATE USER PRESENCE
export const updateUserPresence = async (projectId: string, userId: string, fields: Omit<UserPresence, 'id' | 'updatedAt'>): Promise<boolean> => {
  const path = `projects/${projectId}/presence/${userId}`;
  try {
    const docRef = doc(db, 'projects', projectId, 'presence', userId);
    const presenceData = {
      ...fields,
      id: userId,
      updatedAt: serverTimestamp()
    };
    await setDoc(docRef, presenceData);
    return true;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, path);
    return false;
  }
};

// LISTEN TO USER PRESENCE
export const listenToPresence = (
  projectId: string,
  onUpdate: (presenceList: UserPresence[]) => void,
  onError?: (err: Error) => void
) => {
  const path = `projects/${projectId}/presence`;
  const colRef = collection(db, 'projects', projectId, 'presence');
  
  return onSnapshot(colRef, (snapshot) => {
    const presenceList: UserPresence[] = [];
    snapshot.forEach((d) => {
      presenceList.push(d.data() as UserPresence);
    });
    onUpdate(presenceList);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};

// REMOVE USER PRESENCE
export const removeUserPresence = async (projectId: string, userId: string): Promise<boolean> => {
  const path = `projects/${projectId}/presence/${userId}`;
  try {
    const docRef = doc(db, 'projects', projectId, 'presence', userId);
    await deleteDoc(docRef);
    return true;
  } catch (error: any) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

// -----------------------------------------
// BCF ISSUE FEED SERVICES
// -----------------------------------------

export const createBCFIssue = async (
  projectId: string,
  fields: Omit<BCFIssue, 'id' | 'createdAt'>
): Promise<string> => {
  const issueId = `bcf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const path = `projects/${projectId}/bcfIssues/${issueId}`;
  try {
    const issueData: BCFIssue = {
      ...fields,
      id: issueId,
      projectId,
      createdAt: serverTimestamp()
    };
    await setDoc(doc(db, 'projects', projectId, 'bcfIssues', issueId), issueData);
    return issueId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return '';
  }
};

export const deleteBCFIssue = async (projectId: string, issueId: string): Promise<boolean> => {
  const path = `projects/${projectId}/bcfIssues/${issueId}`;
  try {
    await deleteDoc(doc(db, 'projects', projectId, 'bcfIssues', issueId));
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    return false;
  }
};

export const updateBCFIssueSyncState = async (
  projectId: string,
  issueId: string,
  synced: boolean,
  syncedClashId: string
): Promise<void> => {
  const path = `projects/${projectId}/bcfIssues/${issueId}`;
  try {
    await updateDoc(doc(db, 'projects', projectId, 'bcfIssues', issueId), {
      synced,
      syncedClashId,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const listenToBCFIssues = (
  projectId: string,
  onUpdate: (issues: BCFIssue[]) => void,
  onError?: (err: Error) => void
) => {
  const path = `projects/${projectId}/bcfIssues`;
  const q = query(
    collection(db, 'projects', projectId, 'bcfIssues'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    const issues: BCFIssue[] = [];
    snapshot.forEach((d) => {
      issues.push(d.data() as BCFIssue);
    });
    onUpdate(issues);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
    if (onError) onError(error);
  });
};
