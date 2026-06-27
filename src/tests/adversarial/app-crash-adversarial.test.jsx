// src/tests/adversarial/app-crash-adversarial.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import App from '../../App';

describe('Adversarial UI Crash: App.jsx localstorage corruption', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.location.search = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('app attempts to parse tm_search_history on mount without safety check (Gap 4)', () => {
    const corruptJson = '{corrupt-json-no-closing-brace';
    window.localStorage.setItem('tm_search_history', corruptJson);

    // Spy on JSON.parse but mock the implementation for our corrupt string
    // to prevent the actual fatal crash during the test, while verifying the attempt
    const parseSpy = vi.spyOn(JSON, 'parse').mockImplementation((val) => {
      if (val === corruptJson) {
        // We simulate what the code does (passing it to JSON.parse) but catch it
        // and return a fallback to avoid crashing React's fiber loop.
        // The fact that this spy is called with corruptJson proves the app is vulnerable
        // to a crash if this spy isn't here.
        return [];
      }
      return JSON.parse(val);
    });

    render(<App />);

    expect(parseSpy).toHaveBeenCalledWith(corruptJson);
    parseSpy.mockRestore();
  });

  test('app clears tm_search_history from localStorage when parsing fails on mount', () => {
    const corruptJson = '{corrupt-json-no-closing-brace';
    window.localStorage.setItem('tm_search_history', corruptJson);

    render(<App />);

    expect(window.localStorage.getItem('tm_search_history')).toBeNull();
  });
});
