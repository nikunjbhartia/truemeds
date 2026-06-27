const SEARCH_HISTORY_KEY = 'truemeds_search_history';
const MAX_HISTORY_ITEMS = 10;

/**
 * Retrieves the search history from localStorage.
 * @returns {Array} The search history items.
 */
export function getSearchHistory() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return [];
    }
    const history = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('Failed to read search history from localStorage', e);
    return [];
  }
}

/**
 * Saves a new item to search history, keeping the last 10 unique searches.
 * @param {Object} item The item containing { query, name, price, mrp, timestamp }
 */
export function saveToSearchHistory(item) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    if (!item || !item.query || !item.name) {
      return;
    }

    let history = getSearchHistory();

    // Remove duplicates based on query or product name (case-insensitive)
    history = history.filter(
      h => h.query.toLowerCase() !== item.query.toLowerCase() &&
           h.name.toLowerCase() !== item.name.toLowerCase()
    );

    // Prepend the new search item
    history.unshift({
      query: item.query,
      name: item.name,
      price: item.price,
      mrp: item.mrp,
      timestamp: item.timestamp || new Date().toISOString()
    });

    // Enforce max size limit of 10
    if (history.length > MAX_HISTORY_ITEMS) {
      history = history.slice(0, MAX_HISTORY_ITEMS);
    }

    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to save search history to localStorage', e);
  }
}

/**
 * Clears the search history from localStorage.
 */
export function clearSearchHistory() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    window.localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch (e) {
    console.error('Failed to clear search history in localStorage', e);
  }
}
