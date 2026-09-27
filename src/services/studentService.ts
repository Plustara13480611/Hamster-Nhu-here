import { collection, doc, getDoc, getDocs, query, setDoc, where, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SwipeRecord, PortfolioChecklist, StudentProfile, CampApplication } from '../types/models';
import { Timestamp } from 'firebase/firestore';

const SWIPES_COLLECTION = 'swipeHistory';
const CHECKLISTS_COLLECTION = 'checklists';

const LOCAL_SWIPES_KEY = 'sp_local_swipes';
const LOCAL_CHECKLIST_KEY = 'sp_local_checklist';

// Fetch user swipe history (instant local cache + Firestore sync)
export async function fetchSwipeHistory(studentId: string): Promise<SwipeRecord[]> {
  const localKey = `${LOCAL_SWIPES_KEY}_${studentId}`;
  const localData = localStorage.getItem(localKey);
  const cached: SwipeRecord[] = localData ? JSON.parse(localData).map((r: any) => ({
    ...r,
    timestamp: new Date(r.timestamp)
  })) : [];

  try {
    const q = query(collection(db, SWIPES_COLLECTION), where('studentId', '==', studentId));
    const snap = await Promise.race([
      getDocs(q),
      new Promise<null>((r) => setTimeout(() => r(null), 1200))
    ]);
    if (snap && !snap.empty) {
      const records = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentId: data.studentId,
          campId: data.campId,
          action: data.action,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
        };
      });
      localStorage.setItem(localKey, JSON.stringify(records));
      return records;
    }
  } catch (e) {
    console.warn("Firestore fetchSwipeHistory skipped/timeout:", e);
  }
  return cached;
}

// Helper to remove undefined fields which Firestore rejects
function cleanForFirestore(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (obj instanceof Date) return Timestamp.fromDate(obj);
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        res[key] = cleanForFirestore(val);
      }
    }
    return res;
  }
  return obj;
}

// Record a new swipe
export async function recordSwipe(record: Omit<SwipeRecord, 'id'>): Promise<string> {
  const localId = 'swipe_' + Date.now();
  const fullRecord: SwipeRecord = { ...record, id: localId };

  // Save to local cache first
  const localKey = `${LOCAL_SWIPES_KEY}_${record.studentId}`;
  try {
    const existing: SwipeRecord[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    existing.push(fullRecord);
    localStorage.setItem(localKey, JSON.stringify(existing));
  } catch (err) {
    console.warn("Could not cache swipe locally:", err);
  }

  // Sync to Firestore in background without blocking
  try {
    const cleanRecord = cleanForFirestore(record);
    addDoc(collection(db, SWIPES_COLLECTION), cleanRecord).catch(err => {
      console.warn("Background Firestore recordSwipe skipped:", err);
    });
  } catch (err) {
    console.warn("recordSwipe clean error:", err);
  }

  return localId;
}

// Fetch user checklist
export async function fetchChecklist(studentId: string): Promise<PortfolioChecklist | null> {
  const localKey = `${LOCAL_CHECKLIST_KEY}_${studentId}`;
  const localData = localStorage.getItem(localKey);
  const cached: PortfolioChecklist | null = localData ? JSON.parse(localData) : null;

  try {
    const docRef = doc(db, CHECKLISTS_COLLECTION, studentId);
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((r) => setTimeout(() => r(null), 1200))
    ]);
    if (snap && snap.exists()) {
      const data = snap.data();
      const chk = {
        ...data,
        lastUpdated: data.lastUpdated instanceof Timestamp ? data.lastUpdated.toDate() : new Date(data.lastUpdated),
        quests: data.quests.map((q: any) => ({
          ...q,
          completedAt: q.completedAt ? (q.completedAt instanceof Timestamp ? q.completedAt.toDate() : new Date(q.completedAt)) : undefined
        }))
      } as PortfolioChecklist;
      localStorage.setItem(localKey, JSON.stringify(chk));
      return chk;
    }
  } catch (e) {
    console.warn("Firestore fetchChecklist skipped/timeout:", e);
  }
  return cached;
}

// Save user checklist
export async function saveChecklist(studentId: string, checklist: PortfolioChecklist): Promise<void> {
  const localKey = `${LOCAL_CHECKLIST_KEY}_${studentId}`;
  localStorage.setItem(localKey, JSON.stringify(checklist));

  // Sync to Firestore in background
  try {
    const docRef = doc(db, CHECKLISTS_COLLECTION, studentId);
    const cleanPayload = cleanForFirestore(checklist);
    setDoc(docRef, cleanPayload).catch(err => {
      console.warn("Background Firestore saveChecklist skipped:", err);
    });
  } catch (err) {
    console.warn("saveChecklist clean error:", err);
  }
}

// Fetch user profile
export async function fetchStudentProfile(studentId: string): Promise<StudentProfile | null> {
  try {
    const docRef = doc(db, 'users', studentId);
    const snap = await Promise.race([
      getDoc(docRef),
      new Promise<null>((r) => setTimeout(() => r(null), 1200))
    ]);
    if (snap && snap.exists()) {
      return snap.data() as StudentProfile;
    }
  } catch (e) {
    console.warn("Firestore fetchStudentProfile skipped/timeout:", e);
  }
  return null;
}

// ─── Application Functions ────────────────────────────────────────────────────

const APPLICATIONS_COLLECTION = 'campApplications';
const LOCAL_APPLICATIONS_KEY = 'sp_local_applications';

export async function submitApplication(app: Omit<CampApplication, 'id'>): Promise<CampApplication> {
  const localId = 'app_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const fullApp: CampApplication = { ...app, id: localId };

  // Save to local cache immediately
  const localKey = `${LOCAL_APPLICATIONS_KEY}_${app.studentId}`;
  try {
    const existing: CampApplication[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    // Avoid duplicate
    const idx = existing.findIndex(a => a.campId === app.campId && a.studentId === app.studentId);
    if (idx >= 0) return existing[idx]; // already applied
    existing.push(fullApp);
    localStorage.setItem(localKey, JSON.stringify(existing));
  } catch (err) {
    console.warn('Could not cache application locally:', err);
  }

  // Sync to Firestore in background
  try {
    const cleanPayload = cleanForFirestore({ ...app });
    addDoc(collection(db, APPLICATIONS_COLLECTION), cleanPayload).catch(err => {
      console.warn('Background Firestore submitApplication skipped:', err);
    });
  } catch (err) {
    console.warn('submitApplication clean error:', err);
  }

  return fullApp;
}

export async function fetchApplications(studentId: string): Promise<CampApplication[]> {
  const localKey = `${LOCAL_APPLICATIONS_KEY}_${studentId}`;
  const localData = localStorage.getItem(localKey);
  const cached: CampApplication[] = localData
    ? JSON.parse(localData).map((a: any) => ({
        ...a,
        appliedAt: new Date(a.appliedAt),
        updatedAt: new Date(a.updatedAt),
      }))
    : [];

  try {
    const q = query(
      collection(db, APPLICATIONS_COLLECTION),
      where('studentId', '==', studentId)
    );
    const snap = await Promise.race([
      getDocs(q),
      new Promise<null>((r) => setTimeout(() => r(null), 1200)),
    ]);
    if (snap && !snap.empty) {
      const records = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          studentId: data.studentId,
          campId: data.campId,
          campTitle: data.campTitle,
          campCoverImageUrl: data.campCoverImageUrl,
          status: data.status,
          appliedAt: data.appliedAt instanceof Timestamp ? data.appliedAt.toDate() : new Date(data.appliedAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          note: data.note,
          applicantInfo: data.applicantInfo,
          payment: data.payment ? {
            ...data.payment,
            paidAt: data.payment.paidAt ? (data.payment.paidAt instanceof Timestamp ? data.payment.paidAt.toDate() : new Date(data.payment.paidAt)) : undefined
          } : undefined,
        } as CampApplication;
      });
      localStorage.setItem(localKey, JSON.stringify(records));
      return records;
    }
  } catch (e) {
    console.warn('Firestore fetchApplications skipped/timeout:', e);
  }
  return cached;
}

export function checkApplicationSync(studentId: string, campId: string): CampApplication | null {
  const localKey = `${LOCAL_APPLICATIONS_KEY}_${studentId}`;
  try {
    const existing: any[] = JSON.parse(localStorage.getItem(localKey) || '[]');
    const found = existing.find((a: any) => a.campId === campId);
    if (!found) return null;
    return {
      ...found,
      appliedAt: found.appliedAt ? new Date(found.appliedAt) : new Date(),
      updatedAt: found.updatedAt ? new Date(found.updatedAt) : new Date(),
    } as CampApplication;
  } catch {
    return null;
  }
}
