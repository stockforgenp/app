/**
 * Authentication & Active Shop Context
 * Provides reactive shop session state, login, registration,
 * and shop switching across the entire application.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Shop, RegisterShopInput, LoginInput } from '../types/index.ts';
import {
  getCurrentShop,
  loginShop,
  registerShop as registerShopService,
  logoutShop,
  getAllShops,
  switchShop as switchShopService,
  seedDemoShopIfEmpty,
  getShopsCount,
} from '../lib/services/authService.ts';
import { getDatabase, subscribeToDbChanges } from '../lib/db/sqliteEngine.ts';

interface AuthContextType {
  currentShop: Shop | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  allShops: Shop[];
  hasAnyShops: boolean;
  login: (input: LoginInput) => Promise<Shop>;
  register: (input: RegisterShopInput) => Promise<Shop>;
  logout: () => void;
  switchShop: (shopId: number) => Promise<Shop>;
  loginDemoShop: () => Promise<Shop>;
  refreshShops: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [allShops, setAllShops] = useState<Shop[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshShops = useCallback(() => {
    try {
      const shops = getAllShops();
      setAllShops(shops);
      const active = getCurrentShop();
      setCurrentShop(active);
    } catch {
      // DB might be initializing
    }
  }, []);

  // Initialize once database is available
  useEffect(() => {
    getDatabase()
      .then(() => {
        refreshShops();
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load database in AuthProvider:', err);
        setIsLoading(false);
      });

    const unsubscribe = subscribeToDbChanges(() => {
      refreshShops();
    });

    return unsubscribe;
  }, [refreshShops]);

  const login = useCallback(async (input: LoginInput): Promise<Shop> => {
    const shop = await loginShop(input);
    setCurrentShop(shop);
    refreshShops();
    return shop;
  }, [refreshShops]);

  const register = useCallback(async (input: RegisterShopInput): Promise<Shop> => {
    const shop = await registerShopService(input);
    setCurrentShop(shop);
    refreshShops();
    return shop;
  }, [refreshShops]);

  const logout = useCallback(() => {
    logoutShop();
    setCurrentShop(null);
    refreshShops();
  }, [refreshShops]);

  const switchShop = useCallback(async (shopId: number): Promise<Shop> => {
    const shop = switchShopService(shopId);
    if (!shop) {
      throw new Error('Shop not found');
    }
    setCurrentShop(shop);
    refreshShops();
    return shop;
  }, [refreshShops]);

  const loginDemoShop = useCallback(async (): Promise<Shop> => {
    const shop = await seedDemoShopIfEmpty();
    setCurrentShop(shop);
    refreshShops();
    return shop;
  }, [refreshShops]);

  return (
    <AuthContext.Provider
      value={{
        currentShop,
        isAuthenticated: !!currentShop,
        isLoading,
        allShops,
        hasAnyShops: allShops.length > 0 || getShopsCount() > 0,
        login,
        register,
        logout,
        switchShop,
        loginDemoShop,
        refreshShops,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
