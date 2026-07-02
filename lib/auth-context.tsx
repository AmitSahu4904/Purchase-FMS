"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";

interface AuthContextType {
  isAuthenticated: boolean;
  user: string | null;
  fullName: string | null;
  role: string | null;
  pageAccess: string[];
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [pageAccess, setPageAccess] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check for existing session on mount and refresh data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedUser = localStorage.getItem("user");
        const storedFullName = localStorage.getItem("fullName");
        const storedRole = localStorage.getItem("role");
        const storedAuth = localStorage.getItem("isAuthenticated");
        const storedAccess = localStorage.getItem("pageAccess");

        if (storedAuth === "true" && storedUser) {
          // 1. Instant Restore from LocalStorage
          setIsAuthenticated(true);
          setUser(storedUser);
          setFullName(storedFullName);
          setRole(storedRole);
          if (storedAccess) {
            setPageAccess(JSON.parse(storedAccess));
          }

          // 2. Background Refresh from API (skip for hardcoded credentials)
          const apiUri = process.env.NEXT_PUBLIC_API_URI;
          const isHardcoded = storedUser === "user" || storedUser === "admin";
          if (apiUri && !isHardcoded) {
            try {
              const response = await fetch(`${apiUri}?sheet=Master`);
              if (response.ok) {
                const responseData = await response.json();
                const rows = responseData.data;

                if (Array.isArray(rows)) {
                  const foundUser = rows.slice(1).find((row: any) => {
                    const sheetUsername = Array.isArray(row) ? row[0] : row.Username;
                    return String(sheetUsername || "").trim() === storedUser.trim();
                  });

                  if (foundUser) {
                    const newFullName = Array.isArray(foundUser) ? foundUser[1] : foundUser["Full Name"];
                    const newRole = Array.isArray(foundUser) ? foundUser[3] : foundUser["Role"];
                    const accessStr = Array.isArray(foundUser) ? foundUser[4] : foundUser["page access"];
                    const newAccessList = accessStr
                      ? String(accessStr).split(",").map(p => p.trim()).filter(Boolean)
                      : [];

                    // Update State
                    setFullName(newFullName || storedUser);
                    setRole(newRole || "User");
                    setPageAccess(newAccessList);

                    // Update Storage
                    localStorage.setItem("fullName", newFullName || storedUser);
                    localStorage.setItem("role", newRole || "User");
                    localStorage.setItem("pageAccess", JSON.stringify(newAccessList));
                  }
                }
              }
            } catch (fetchErr) {
              console.error("Background sync failed", fetchErr);
            }
          }
        }
      } catch (e) {
        console.error("Auth initialization error", e);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const u = username.trim().toLowerCase();
      const p = password.trim();

      let matchedUser = null;

      if (u === "admin" && p === "admin123") {
        matchedUser = {
          username: "admin",
          fullName: "Admin",
          role: "Admin",
          pageAccess: []
        };
      } else if (u === "user" && p === "user123") {
        matchedUser = {
          username: "user",
          fullName: "User",
          role: "User",
          pageAccess: []
        };
      }

      if (matchedUser) {
        setIsAuthenticated(true);
        setUser(matchedUser.username);
        setFullName(matchedUser.fullName);
        setRole(matchedUser.role);
        setPageAccess(matchedUser.pageAccess);

        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", matchedUser.username);
        localStorage.setItem("fullName", matchedUser.fullName);
        localStorage.setItem("role", matchedUser.role);
        localStorage.setItem("pageAccess", JSON.stringify(matchedUser.pageAccess));

        router.push("/");
        return true;
      }

      const apiUri = process.env.NEXT_PUBLIC_API_URI;
      if (!apiUri) {
        console.error("API URI not found in environment variables");
        return false;
      }

      // Fetch data from the Google Sheet via the Apps Script API
      const response = await fetch(`${apiUri}?sheet=Master`);
      if (!response.ok) {
        throw new Error("Failed to fetch user data from the API");
      }

      const responseData = await response.json();
      const rows = responseData.data;

      if (!Array.isArray(rows)) {
        console.error("API response data is not an array:", rows);
        return false;
      }

      // Skip the header row and search for the user
      const foundUser = rows.slice(1).find((row: any) => {
        const sheetUsername = Array.isArray(row) ? row[0] : row.Username;
        const sheetPassword = Array.isArray(row) ? row[2] : row.Password;

        return String(sheetUsername || "").trim() === username.trim() &&
          String(sheetPassword || "").trim() === password.trim();
      });

      if (foundUser) {
        // Col B (Index 1): Full Name
        // Col D (Index 3): Role
        // Col E (Index 4): Page Access
        const sheetFullName = Array.isArray(foundUser) ? foundUser[1] : foundUser["Full Name"];
        const sheetRole = Array.isArray(foundUser) ? foundUser[3] : foundUser["Role"];
        const accessStr = Array.isArray(foundUser) ? foundUser[4] : foundUser["page access"];

        const accessList = accessStr
          ? String(accessStr).split(",").map(p => p.trim()).filter(Boolean)
          : [];

        setIsAuthenticated(true);
        setUser(username);
        setFullName(sheetFullName || username);
        setRole(sheetRole || "User");
        setPageAccess(accessList);

        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("user", username);
        localStorage.setItem("fullName", sheetFullName || username);
        localStorage.setItem("role", sheetRole || "User");
        localStorage.setItem("pageAccess", JSON.stringify(accessList));

        router.push("/");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Login Error:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setFullName(null);
    setRole(null);
    setPageAccess([]);

    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("user");
    localStorage.removeItem("fullName");
    localStorage.removeItem("role");
    localStorage.removeItem("pageAccess");

    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, fullName, role, pageAccess, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
