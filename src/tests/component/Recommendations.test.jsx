import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import Recommendations from '../../components/Recommendations';

describe('Recommendations component', () => {
  const mockRecs = [
    {
      category: 'Queried Brand (Standalone)',
      brand: 'Ecosprin 75 Tablet 14',
      mrp: 5.28,
      price: 4.44,
      unit_price: 0.32,
      savings_percent: 15.91,
      link: 'https://www.truemeds.in/ecosprin-75',
      details: ''
    },
    {
      category: 'Queried Brand (Cheapest Swap)',
      brand: 'Ecosprin 75 Tablet 14',
      mrp: 5.28,
      price: 4.22,
      unit_price: 0.30,
      savings_percent: 20.23,
      link: 'https://www.truemeds.in/delisprin-75',
      details: 'Buy parent **Delisprin 75** & swap for **Ecosprin 75** in cart'
    }
  ];

  test('renders recommended cards side-by-side with correct categories and pricing', () => {
    render(<Recommendations recommendations={mockRecs} />);

    expect(screen.getByText('Queried Brand (Standalone)')).toBeInTheDocument();
    expect(screen.getByText('Queried Brand (Cheapest Swap)')).toBeInTheDocument();
    
    // Check brand names are displayed (multiple matches)
    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBe(2);

    // Check swap instruction details text is rendered with bolding stripped
    expect(screen.getByText('Buy parent Delisprin 75 & swap for Ecosprin 75 in cart')).toBeInTheDocument();

    // Check savings percentages
    expect(screen.getByText('Save 16%')).toBeInTheDocument();
    expect(screen.getByText('Save 20%')).toBeInTheDocument();
  });

  test('returns null when recommendations list is empty or missing', () => {
    const { container } = render(<Recommendations recommendations={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
