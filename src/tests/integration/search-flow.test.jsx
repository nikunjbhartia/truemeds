// src/tests/integration/search-flow.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { installFetchMock } from '../helpers/mock-fetch';

describe('Tier 3 Integration: Search Flow', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    // Start with clean location search
    window.location.search = '';
  });

  afterEach(() => {
    fetchMock?.restore();
  });

  test('successfully triggers search, loads and renders results, and updates filters', async () => {
    // Install the routing fetch mock
    fetchMock = installFetchMock();

    render(<App />);

    // 1. Initial State: No results or searches yet
    expect(screen.getByText('No Medicine Searched Yet')).toBeInTheDocument();

    // 2. Perform Search for "ecosprin 75 tablet 14"
    const input = screen.getByPlaceholderText(/Enter medicine name/);
    const searchBtn = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'ecosprin 75 tablet 14' } });
    fireEvent.click(searchBtn);

    // 3. Loading state shown
    expect(screen.getByText('Searching...')).toBeInTheDocument();

    // 4. Wait for results to load
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    // 5. Prescribed card rendered
    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Aspirin/i).length).toBeGreaterThan(0); // Composition salt

    // 6. Alternatives/Substitutes list rendered
    const cardTitles = await screen.findAllByText(/Delisprin 75/i);
    expect(cardTitles[0]).toBeInTheDocument();
    expect(screen.getAllByText('Save 25%').length).toBeGreaterThan(0); // Savings percent


    // 8. Filters can be toggled
    const exactBtn = screen.getByText('EXACT MATCH');
    fireEvent.click(exactBtn);

    // After exact match, we should see exact match cards
    expect(screen.getAllByText(/Delisprin 75/i).length).toBeGreaterThan(0);
  });

  test('automatically triggers search on mount when URL query parameter "search" is present', async () => {
    window.location.search = '?search=ecosprin+75+tablet+14';
    fetchMock = installFetchMock();

    render(<App />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Aspirin/i).length).toBeGreaterThan(0);
  });

  test('automatically triggers search on mount when URL query parameter "q" is present', async () => {
    window.location.search = '?q=ecosprin+75+tablet+14';
    fetchMock = installFetchMock();

    render(<App />);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBeGreaterThan(0);
  });
});
