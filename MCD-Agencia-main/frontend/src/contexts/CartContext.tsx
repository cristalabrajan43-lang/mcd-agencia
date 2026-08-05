'use client';

/**
 * Cart Context for MCD-Agencia.
 *
 * This module provides shopping cart state management:
 *   - Cart state
 *   - Add/remove/update items
 *   - Cart synchronization with API
 *   - Guest cart with localStorage
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import {
  Cart,
  GuestCartItem,
  getCart,
  addToCart as apiAddToCart,
  updateCartItem as apiUpdateCartItem,
  removeCartItem as apiRemoveCartItem,
  clearCart as apiClearCart,
  mergeGuestCart,
} from '@/lib/api/orders';

const GUEST_CART_KEY = 'mcd_guest_cart';

interface GuestCartState {
  items: GuestCartItem[];
  itemCount: number;
}

interface CartContextType {
  cart: Cart | null;
  guestCart: GuestCartState;
  isLoading: boolean;
  itemCount: number;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: React.ReactNode;
}

// Helper functions for localStorage
function getGuestCartFromStorage(): GuestCartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(GUEST_CART_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveGuestCartToStorage(items: GuestCartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
  } catch {
    // Silent fail - localStorage might be unavailable
  }
}

function clearGuestCartFromStorage(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_CART_KEY);
  } catch {
    // Silent fail - localStorage might be unavailable
  }
}

export function CartProvider({ children }: CartProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [guestCart, setGuestCart] = useState<GuestCartState>({ items: [], itemCount: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const hasMergedRef = useRef<boolean>(false);
  const lastAuthStateRef = useRef<boolean | null>(null);

  // Load guest cart from localStorage on mount
  useEffect(() => {
    const items = getGuestCartFromStorage();
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    setGuestCart({ items, itemCount });
  }, []);

  // Handle authentication change - merge guest cart when user logs in
  useEffect(() => {
    // Wait for auth to finish loading before doing anything
    if (authLoading) {
      return;
    }

    // Skip if auth state hasn't changed
    if (lastAuthStateRef.current === isAuthenticated) {
      return;
    }
    
    const prevAuthState = lastAuthStateRef.current;
    lastAuthStateRef.current = isAuthenticated;

    const handleAuthChange = async () => {
      if (isAuthenticated) {
        // User is now authenticated
        const guestItems = getGuestCartFromStorage();

        if (guestItems.length > 0 && !hasMergedRef.current) {
          // We have guest items and haven't merged yet - do merge
          setIsLoading(true);
          hasMergedRef.current = true; // Mark as merged to prevent duplicate merges
          try {
            const mergedCart = await mergeGuestCart(guestItems);
            setCart(mergedCart);
            // Clear guest cart after successful merge
            clearGuestCartFromStorage();
            setGuestCart({ items: [], itemCount: 0 });
            if (mergedCart.item_count > 0) {
              toast.success(`Se agregaron ${mergedCart.item_count} productos a tu carrito`);
            }
          } catch (error) {
            console.error('Error merging guest cart:', error);
            hasMergedRef.current = false; // Reset so we can try again
            // Clear invalid guest cart items
            clearGuestCartFromStorage();
            setGuestCart({ items: [], itemCount: 0 });
            // Still try to fetch the regular cart
            try {
              const fetchedCart = await getCart();
              setCart(fetchedCart);
            } catch {
              // Silent fail - cart will be empty
            }
            toast.error('Algunos productos del carrito no pudieron ser recuperados');
          } finally {
            setIsLoading(false);
          }
        } else {
          // No guest cart to merge - just fetch user's existing cart
          setIsLoading(true);
          try {
            const fetchedCart = await getCart();
            setCart(fetchedCart);
          } catch {
            // Silent fail - cart will be empty
          } finally {
            setIsLoading(false);
          }
        }
      } else {
        // User logged out - clear server cart state and reset merge flag
        setCart(null);
        hasMergedRef.current = false; // Reset for next login
      }
    };

    handleAuthChange();
  }, [isAuthenticated, authLoading]);

  // Refresh cart (only for authenticated users)
  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(null);
      // Reload guest cart from storage
      const items = getGuestCartFromStorage();
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      setGuestCart({ items, itemCount });
      return;
    }

    setIsLoading(true);
    try {
      const fetchedCart = await getCart();
      setCart(fetchedCart);
    } catch {
      // Silent fail - cart will remain in current state
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const addItem = useCallback(async (variantId: string, quantity: number = 1) => {
    if (!isAuthenticated) {
      // Handle guest cart with localStorage
      const currentItems = getGuestCartFromStorage();
      const existingIndex = currentItems.findIndex(item => item.variant_id === variantId);

      if (existingIndex >= 0) {
        currentItems[existingIndex].quantity += quantity;
      } else {
        currentItems.push({ variant_id: variantId, quantity });
      }

      saveGuestCartToStorage(currentItems);
      const itemCount = currentItems.reduce((sum, item) => sum + item.quantity, 0);
      setGuestCart({ items: currentItems, itemCount });
      return;
    }

    setIsLoading(true);
    try {
      const updatedCart = await apiAddToCart(variantId, quantity);
      setCart(updatedCart);
    } catch (error) {
      console.error('Error adding to cart:', error);
      throw error; // Re-throw to let the UI handle it
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    if (!isAuthenticated) {
      // For guest cart, itemId is actually the variant_id
      const currentItems = getGuestCartFromStorage();
      const existingIndex = currentItems.findIndex(item => item.variant_id === itemId);
      
      if (existingIndex >= 0) {
        if (quantity <= 0) {
          currentItems.splice(existingIndex, 1);
        } else {
          currentItems[existingIndex].quantity = quantity;
        }
        
        saveGuestCartToStorage(currentItems);
        const itemCount = currentItems.reduce((sum, item) => sum + item.quantity, 0);
        setGuestCart({ items: currentItems, itemCount });
      }
      return;
    }

    setIsLoading(true);
    try {
      const updatedCart = await apiUpdateCartItem(itemId, quantity);
      setCart(updatedCart);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const removeItem = useCallback(async (itemId: string) => {
    if (!isAuthenticated) {
      // For guest cart, itemId is actually the variant_id
      const currentItems = getGuestCartFromStorage();
      const filteredItems = currentItems.filter(item => item.variant_id !== itemId);
      
      saveGuestCartToStorage(filteredItems);
      const itemCount = filteredItems.reduce((sum, item) => sum + item.quantity, 0);
      setGuestCart({ items: filteredItems, itemCount });
      return;
    }

    setIsLoading(true);
    try {
      const updatedCart = await apiRemoveCartItem(itemId);
      setCart(updatedCart);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const clearCartFn = useCallback(async () => {
    if (!isAuthenticated) {
      clearGuestCartFromStorage();
      setGuestCart({ items: [], itemCount: 0 });
      return;
    }

    setIsLoading(true);
    try {
      const emptyCart = await apiClearCart();
      setCart(emptyCart);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Calculate item count based on auth state
  const itemCount = isAuthenticated ? (cart?.item_count || 0) : guestCart.itemCount;

  const value: CartContextType = {
    cart,
    guestCart,
    isLoading,
    itemCount,
    addItem,
    updateItem,
    removeItem,
    clearCart: clearCartFn,
    refreshCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
