// src/tests/integration/error-flow.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../../App';
import { installFetchMock } from '../helpers/mock-fetch';

describe('Tier 3 Integration: Error Flow', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.search = '';
  });

  afterEach(() => {
    fetchMock?.restore();
  });

  test('handles 500 API failure gracefully', async () => {
    // Mock all fetches to return 500
    fetchMock = installFetchMock({
      routeMap: {
        '*': () => new Response('Internal Server Error', { status: 500 })
      }
    });

    render(<App />);

    const input = screen.getByPlaceholderText(/Enter medicine name/);
    const searchBtn = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'some medicine' } });
    fireEvent.click(searchBtn);

    expect(screen.getByText('Searching...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch results. Please try again.')).toBeInTheDocument();
  });

  test('handles empty search results gracefully', async () => {
    // Mock search to return empty list
    fetchMock = installFetchMock({
      routeMap: {
        'nonexistent': {
          '1': { response: { resultList: [] } }
        }
      }
    });

    render(<App />);

    const input = screen.getByPlaceholderText(/Enter medicine name/);
    const searchBtn = screen.getByRole('button', { name: /search/i });

    fireEvent.change(input, { target: { value: 'nonexistent' } });
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('No results found.')).toBeInTheDocument();
  });
});
