import { useState, useCallback, useRef } from 'react';

export interface PostalCodeData {
  codigo_postal: string;
  estado: string;
  municipio: string;
  colonias: string[];
}

interface UsePostalCodeReturn {
  /** Fetched postal code data (null if not yet fetched or error) */
  data: PostalCodeData | null;
  /** Whether a lookup is currently in progress */
  loading: boolean;
  /** Error message if the last lookup failed */
  error: string;
  /** Trigger a lookup for the given 5-digit postal code */
  lookup: (cp: string) => Promise<PostalCodeData | null>;
  /** Clear all state */
  reset: () => void;
}

/**
 * Hook to look up Mexican postal codes via /api/postal-code/[cp].
 * Returns estado, municipio, and colonias for the given CP.
 *
 * Usage:
 *   const { data, loading, error, lookup, reset } = usePostalCode();
 *   // When user types 5 digits:
 *   const result = await lookup('39890');
 *   // result?.estado → "Guerrero"
 *   // result?.colonias → ["Alborada Cardenista", "Granjas Del Marquez", ...]
 */
export function usePostalCode(): UsePostalCodeReturn {
  const [data, setData] = useState<PostalCodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const lookup = useCallback(async (cp: string): Promise<PostalCodeData | null> => {
    // Validate
    if (!/^\d{5}$/.test(cp)) {
      setError('El código postal debe tener 5 dígitos');
      setData(null);
      return null;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/postal-code/${cp}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.error || 'Código postal no encontrado';
        setError(msg);
        setLoading(false);
        return null;
      }

      const result: PostalCodeData = await res.json();
      setData(result);
      setLoading(false);
      return result;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null; // Request was cancelled, don't update state
      }
      setError('Error al buscar el código postal');
      setLoading(false);
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setData(null);
    setLoading(false);
    setError('');
  }, []);

  return { data, loading, error, lookup, reset };
}
