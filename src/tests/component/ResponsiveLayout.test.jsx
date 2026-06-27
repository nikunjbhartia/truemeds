// src/tests/component/ResponsiveLayout.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ResponsiveLayout from '../../components/ResponsiveLayout';
import App from '../../App';
import { installFetchMock } from '../helpers/mock-fetch';

describe('ResponsiveLayout component', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.search = '';
  });

  afterEach(() => {
    fetchMock?.restore();
  });

  test('renders children and has responsive grid classes', () => {
    const { container } = render(
      <ResponsiveLayout>
        <div data-testid="left-col">Left</div>
        <div data-testid="right-col">Right</div>
      </ResponsiveLayout>
    );
    expect(screen.getByTestId('left-col')).toBeInTheDocument();
    expect(screen.getByTestId('right-col')).toBeInTheDocument();
    
    // Check grid layout classes
    const gridDiv = container.firstChild;
    expect(gridDiv.className).toContain('grid');
    expect(gridDiv.className).toContain('grid-cols-1');
    expect(gridDiv.className).toContain('lg:grid-cols-12');
  });

  test('renders MobileAlternativeStack at <768px', async () => {
    globalThis.__setViewportWidth?.(375);
    fetchMock = installFetchMock();

    render(<App initialQuery="ecosprin 75 tablet 14" />);

    // Wait for search to load
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-stack')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-table')).toBeNull();
  });

  test('switches subtree when viewport grows', async () => {
    globalThis.__setViewportWidth?.(375);
    fetchMock = installFetchMock();

    render(<App initialQuery="ecosprin 75 tablet 14" />);

    // Wait for search to load
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('mobile-stack')).toBeInTheDocument();
    expect(screen.queryByTestId('desktop-table')).toBeNull();

    // Resize to desktop (triggers matchMedia mock and React re-render)
    globalThis.__setViewportWidth?.(1280);

    await waitFor(() => {
      expect(screen.getByTestId('desktop-table')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('mobile-stack')).toBeNull();
  });
});
