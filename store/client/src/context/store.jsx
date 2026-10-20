import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get('/api/auth/me');
      setUser(user);
    } catch { setUser(null); }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const logout = async () => {
    await api.post('/api/auth/logout');
    setUser(null);
  };

  const hasRole = (...roles) => !!user && (user.roles || []).some((r) => roles.includes(r));

  return <AuthCtx.Provider value={{ user, loading, refresh, logout, hasRole, setUser }}>{children}</AuthCtx.Provider>;
}

const CartCtx = createContext(null);
export const useCart = () => useContext(CartCtx);

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], count: 0, subtotalPaise: 0 });

  const refresh = useCallback(async () => {
    try {
      const c = await api.get('/api/cart');
      setCart(c);
    } catch { /* cart is best-effort */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (sku, qty = 1) => {
    const c = await api.post('/api/cart/items', { sku, qty });
    setCart(c);
    return c;
  };
  const setQty = async (sku, qty) => {
    const c = await api.patch('/api/cart/items', { sku, qty });
    setCart(c);
  };
  const remove = async (sku) => {
    const c = await api.del(`/api/cart/items/${encodeURIComponent(sku)}`);
    setCart(c);
  };

  return <CartCtx.Provider value={{ cart, refresh, add, setQty, remove }}>{children}</CartCtx.Provider>;
}
