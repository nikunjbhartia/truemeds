// src/tests/unit/search-history.test.js
import { describe, test, expect, beforeEach } from 'vitest';

const HISTORY_KEY = 'tm_search_history';

// Helper to simulate the App's history update logic
function updateHistory(currentHistory, queryStr) {
  const updated = [queryStr, ...currentHistory.filter(item => item !== queryStr)].slice(0, 5);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  return updated;
}

describe('Tier 1: Search History unit logic & localStorage serialization', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('should load empty history if none in localStorage', () => {
    const saved = window.localStorage.getItem(HISTORY_KEY);
    const history = saved ? JSON.parse(saved) : [];
    expect(history).toEqual([]);
  });

  test('should add new items to the history', () => {
    let history = [];
    history = updateHistory(history, 'dolo');
    expect(history).toEqual(['dolo']);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toEqual(['dolo']);

    history = updateHistory(history, 'ecosprin');
    expect(history).toEqual(['ecosprin', 'dolo']);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toEqual(['ecosprin', 'dolo']);
  });

  test('should remove duplicates and move re-searched item to the top', () => {
    let history = ['dolo', 'ecosprin', 'pan-40'];
    history = updateHistory(history, 'ecosprin');
    expect(history).toEqual(['ecosprin', 'dolo', 'pan-40']);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toEqual(['ecosprin', 'dolo', 'pan-40']);
  });

  test('should limit history items to maximum of 5', () => {
    let history = ['a', 'b', 'c', 'd', 'e'];
    history = updateHistory(history, 'f');
    expect(history).toEqual(['f', 'a', 'b', 'c', 'd']);
    expect(history.length).toBe(5);
    expect(JSON.parse(window.localStorage.getItem(HISTORY_KEY))).toEqual(['f', 'a', 'b', 'c', 'd']);
  });

  test('should clear history', () => {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(['dolo', 'ecosprin']));
    window.localStorage.removeItem(HISTORY_KEY);
    expect(window.localStorage.getItem(HISTORY_KEY)).toBeNull();
  });
});
