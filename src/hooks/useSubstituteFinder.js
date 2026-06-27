import { useState, useEffect } from 'react';
import { findSubstitutes } from '../js/substitute-finder';
import { saveToSearchHistory } from '../js/search-history';

/**
 * Custom React hook to coordinate medicine search, loading states, and search history recording.
 * @param {string} query The search query string.
 * @param {string} warehouseId The Truemeds warehouse ID (default: "1").
 * @returns {Object} An object containing { data, loading, error }
 */
export function useSubstituteFinder(query, warehouseId = '1') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!query || !query.trim()) {
      setData(null);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await findSubstitutes(query, warehouseId);
        if (isMounted) {
          setData(result);
          if (result && result.queried_medicine) {
            // Save successful search to localStorage history
            saveToSearchHistory({
              query: query,
              name: result.queried_medicine.name,
              price: result.queried_medicine.price,
              mrp: result.queried_medicine.mrp,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to find substitutes');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [query, warehouseId]);

  return { data, loading, error };
}
