import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { StudentProfile, OrganizerProfile } from '../types/models';
import { mockStudent } from '../data/mockData';

export interface AppUser {
  uid: string;
  email?: string | null;
  isAnonymous?: boolean;
}

type UserProfile = StudentProfile | OrganizerProfile;

interface AuthContextType {
  user: AppUser | null;
  profile: UserProfile | null;
  loading: boolean;
  setDemoSession: (role: 'student' | 'organizer') => Promise<void>;
  setUserSession: (appUser: AppUser, profile: UserProfile) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
}

function getStoredSession(): { user: AppUser | null; profile: UserProfile | null } {
  try {
    const saved = localStorage.getItem('sp_demo_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.profile) {
        return {
          user: { uid: parsed.uid, email: parsed.profile.email || `${parsed.role}@demo.local`, isAnonymous: !parsed.profile.email },
          profile: parsed.profile
        };
      }
      const demoUser: AppUser = { uid: parsed.uid, email: `${parsed.role}@demo.local`, isAnonymous: true };
      const demoProfile: UserProfile = parsed.role === 'student' ? {
        ...mockStudent,
        id: parsed.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      } : {
        id: parsed.uid,
        email: 'org@example.com',
        role: 'organizer',
        organizationName: 'Demo Organization',
        contactEmail: 'org@example.com',
        description: 'A demo organization',
        verified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      return { user: demoUser, profile: demoProfile };
    }
  } catch {
    localStorage.removeItem('sp_demo_user');
  }
  return { user: null, profile: null };
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: false,
  setDemoSession: async () => {},
  setUserSession: async () => {},
  updateProfile: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const initial = getStoredSession();
  const [user, setUser] = useState<AppUser | null>(initial.user);
  const [profile, setProfile] = useState<UserProfile | null>(initial.profile);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          isAnonymous: firebaseUser.isAnonymous,
        });
        try {
          const docRef = doc(db, 'users', firebaseUser.uid);
          const docSnap = await Promise.race([
            getDoc(docRef),
            new Promise<null>((r) => setTimeout(() => r(null), 1000))
          ]);
          if (docSnap && docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
        } catch (error) {
          console.warn("Could not fetch user profile from Firestore:", error);
        }
      }
    });

    return unsubscribe;
  }, []);

  const setUserSession = async (appUser: AppUser, userProfile: UserProfile) => {
    localStorage.setItem('sp_demo_user', JSON.stringify({
      uid: appUser.uid,
      role: userProfile.role,
      profile: userProfile
    }));
    if (userProfile.email) {
      localStorage.setItem(`sp_user_profile_${userProfile.email.toLowerCase().trim()}`, JSON.stringify(userProfile));
    }
    localStorage.setItem(`sp_user_profile_${appUser.uid}`, JSON.stringify(userProfile));
    setUser(appUser);
    setProfile(userProfile);
    setLoading(false);

    // Sync to Firestore non-blocking
    try {
      const userRef = doc(db, 'users', appUser.uid);
      setDoc(userRef, userProfile, { merge: true }).catch(() => {});
    } catch {}
  };

  const setDemoSession = async (role: 'student' | 'organizer') => {
    const demoUid = role === 'student' ? 'demo_student_01' : 'demo_organizer_01';
    const demoUser: AppUser = { uid: demoUid, email: `${role}@demo.local`, isAnonymous: true };

    const defaultProfile: UserProfile = role === 'student' ? {
      ...mockStudent,
      id: demoUid,
      createdAt: new Date(),
      updatedAt: new Date()
    } : {
      id: demoUid,
      email: 'org@example.com',
      role: 'organizer',
      organizationName: 'Demo Organization',
      contactEmail: 'org@example.com',
      description: 'A demo organization',
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    localStorage.setItem('sp_demo_user', JSON.stringify({ uid: demoUid, role, profile: defaultProfile }));
    setUser(demoUser);
    setProfile(defaultProfile);
    setLoading(false);

    // Sync in background non-blocking
    try {
      const userRef = doc(db, 'users', demoUid);
      setDoc(userRef, defaultProfile, { merge: true }).catch(() => {});
    } catch {}
  };

  const updateProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    if (user) {
      localStorage.setItem('sp_demo_user', JSON.stringify({ uid: user.uid, role: newProfile.role, profile: newProfile }));
      if (newProfile.email) {
        localStorage.setItem(`sp_user_profile_${newProfile.email.toLowerCase().trim()}`, JSON.stringify(newProfile));
      }
      localStorage.setItem(`sp_user_profile_${user.uid}`, JSON.stringify(newProfile));
      try {
        const userRef = doc(db, 'users', user.uid);
        setDoc(userRef, newProfile, { merge: true }).catch(() => {});
      } catch {}
    }
  };

  const logout = async () => {
    localStorage.removeItem('sp_demo_user');
    try {
      await signOut(auth);
    } catch {}
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setDemoSession, setUserSession, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
