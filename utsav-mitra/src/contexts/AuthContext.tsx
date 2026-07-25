import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  runTransaction,
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
import { claimPendingInvites } from "@/firebase/invites";
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

  async function loadAndClaim(u: User) {
    const currentProfile = await loadProfile(u);
    // Auto-claim any pending invites for this user's email
    if (u.email) {
      claimPendingInvites(u.uid, u.email, currentProfile.displayName).catch((err) =>
        console.error("Failed to claim pending invites:", err),
      );
    }
  }

  async function loadProfile(u: User): Promise<UserProfile> {
    const ref = doc(db, "users", u.uid);
    try {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const p = snap.data() as UserProfile;
        setProfile(p);
        return p;
      }
      const fallback: UserProfile = {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName || u.email?.split("@")[0] || "User",
        role: "member",
        ownedEventIds: [],
        memberOfEventIds: [],
        createdAt: Date.now(),
      };
      await setDoc(ref, fallback);
      setProfile(fallback);
      return fallback;
    } catch (e) {
      console.error("Failed to load user profile:", e);
      const fallback: UserProfile = {
        uid: u.uid,
        email: u.email ?? "",
        displayName: u.displayName || u.email?.split("@")[0] || "User",
        role: "member",
        ownedEventIds: [],
        memberOfEventIds: [],
        createdAt: Date.now(),
      };
      setProfile(fallback);
      return fallback;
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      try {
        if (u) {
          await loadAndClaim(u);
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
    const userRef = doc(db, "users", cred.user.uid);
    const metaRef = doc(db, "_meta", "appState");

    const createdProfile = await runTransaction(db, async (tx) => {
      const metaSnap = await tx.get(metaRef);
      const isFirst = !metaSnap.exists() || !metaSnap.data()?.firstUserCreated;
      const p: UserProfile = {
        uid: cred.user.uid,
        email,
        displayName,
        role: isFirst ? "superAdmin" : "member",
        ownedEventIds: [],
        memberOfEventIds: [],
        createdAt: Date.now(),
      };
      tx.set(userRef, p);
      if (isFirst) {
        tx.set(metaRef, { firstUserCreated: true, firstUserUid: cred.user.uid, createdAt: Date.now() });
      }
      return p;
    });
    setProfile(createdProfile);
    // Auto-claim invites right after signup
    claimPendingInvites(cred.user.uid, email, displayName).catch((err) =>
      console.error("Failed to claim invites after signup:", err),
    );
  }

  async function login(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function logout() {
    await signOut(auth);
  }

  async function refreshProfile() {
    if (user) await loadAndClaim(user);
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
