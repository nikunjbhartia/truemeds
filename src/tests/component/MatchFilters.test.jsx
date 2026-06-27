// src/tests/component/MatchFilters.test.jsx
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MatchFilters from '../../components/MatchFilters';

describe('MatchFilters component', () => {
  test('renders all filter buttons', () => {
    render(<MatchFilters activeFilter="all" onFilterChange={() => {}} />);
    expect(screen.getByText('ALL MATCH')).toBeInTheDocument();
    expect(screen.getByText('EXACT MATCH')).toBeInTheDocument();
    expect(screen.getByText('STRENGTH MATCH')).toBeInTheDocument();
    expect(screen.getByText('PARTIAL MATCH')).toBeInTheDocument();
  });

  test('clicking button triggers onFilterChange callback', () => {
    const filterSpy = vi.fn();
    render(<MatchFilters activeFilter="all" onFilterChange={filterSpy} />);

    const exactBtn = screen.getByText('EXACT MATCH');
    fireEvent.click(exactBtn);

    expect(filterSpy).toHaveBeenCalledWith('exact');
  });

  test('active filter button has active styling', () => {
    render(<MatchFilters activeFilter="exact" onFilterChange={() => {}} />);
    const exactBtn = screen.getByText('EXACT MATCH');
    const allBtn = screen.getByText('ALL MATCH');
    
    expect(exactBtn.className).toContain('accent-gradient-bg');
    expect(allBtn.className).not.toContain('accent-gradient-bg');
  });
});
