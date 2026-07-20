import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { auth, db } from "@/firebase/config";
import type { UserProfile } from "@/types";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSuperAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(u: User) {
    const ref = doc(db, "users", u.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      } else {
        const fallbackProfile: UserProfile = {
          uid: u.uid,
          email: u.email ?? "",
          displayName: u.displayName || u.email?.split("@")[0] || "User",
          role: "member",
          ownedEventIds: [],
          memberOfEventIds: [],
          createdAt: Date.now(),
        };
        await setDoc(ref, fallbackProfile);
        setProfile(fallbackProfile);
      }
    } catch (e) {
      console.error("Failed to load user profile:", e);
      setProfile({
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName || u.email?.split("@")[0] || "User",
        role: "member",
        ownedEventIds: [],
        memberOfEventIds: [],
        createdAt: Date.now(),
      });
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u) {
          await loadProfile(u);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error("Auth state change error:", err);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function signup(email: string, password: string, displayName: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const usersCol = collection(db, "users");
    const all = await getDocs(usersCol);
    const isFirst = all.empty;
    const profile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName,
      role: isFirst ? "superAdmin" : "member",
      ownedEventIds: [],
      memberOfEventIds: [],
      createdAt: Date.now(),
    };
    await setDoc(doc(db, "users", cred.user.uid), profile);
    setProfile(profile);
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshProfile() {
    if (user) await loadProfile(user);
  }

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        isSuperAdmin: profile?.role === "superAdmin",
        login,
        signup,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
}
