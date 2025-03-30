import React, { createContext, useContext, useState, useCallback } from "react";
import { serverUrl } from "../App";

interface User {
  id: string;
  email: string;
  name: string;
  accessToken: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkAuthStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/auth/status`, {
        credentials: "include",
      });
      const data = await response.json();
      console.log("authentication data:", data);
      if (data.isAuthenticated) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = () => {
    console.log("logging in, going to:", `${serverUrl}/auth/google`);
    window.location.href = `${serverUrl}/auth/google`;
  };

  const logout = async () => {
    window.location.href = `${serverUrl}/auth/logout`;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: true,
        // isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuthStatus,
      }}
    >
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
