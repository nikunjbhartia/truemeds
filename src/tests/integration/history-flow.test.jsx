// src/tests/integration/history-flow.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { installFetchMock } from '../helpers/mock-fetch';

describe('Tier 3 Integration: Search History Flow', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.search = '';
  });

  afterEach(() => {
    fetchMock?.restore();
  });

  test('loads history on mount, renders list, and triggers search on click', async () => {
    // 1. Pre-populate search history in localStorage
    const savedHistory = ['ecosprin 75 tablet 14', 'pan 40 tablet 15'];
    window.localStorage.setItem('tm_search_history', JSON.stringify(savedHistory));

    fetchMock = installFetchMock();

    render(<App />);

    // 2. Focus input to open search history dropdown
    const input = screen.getByPlaceholderText(/Enter medicine name/);
    fireEvent.focus(input);

    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('ecosprin 75 tablet 14')).toBeInTheDocument();
    expect(screen.getByText('pan 40 tablet 15')).toBeInTheDocument();

    // 3. Click on the first history item from dropdown
    const historyItem = screen.getByText('ecosprin 75 tablet 14');
    fireEvent.mouseDown(historyItem); // mouseDown keeps focus and triggers select before blur

    // 4. Loading state shown
    expect(screen.getByText('Searching...')).toBeInTheDocument();

    // 5. Wait for results to load
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    // 6. Prescribed card rendered for the selected medicine
    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBeGreaterThan(0);
  });
});
