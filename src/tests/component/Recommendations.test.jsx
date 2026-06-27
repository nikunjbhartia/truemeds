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
      details: '',
      salts: { 'Aspirin': '75 mg' }
    },
    {
      category: 'Queried Brand (Cheapest Swap)',
      brand: 'Ecosprin 75 Tablet 14',
      mrp: 5.28,
      price: 4.22,
      unit_price: 0.30,
      savings_percent: 20.23,
      link: 'https://www.truemeds.in/delisprin-75',
      details: 'Buy parent **Delisprin 75** & swap for **Ecosprin 75** in cart',
      salts: { 'Aspirin': '75 mg' }
    },
    {
      category: 'Cheapest Exact Match Alternative',
      brand: 'Delisprin 75 Tablet 14',
      mrp: 5.28,
      price: 4.22,
      unit_price: 0.30,
      savings_percent: 20.23,
      link: 'https://www.truemeds.in/delisprin-75',
      details: '',
      salts: { 'Aspirin': '75 mg' }
    },
    {
      category: 'Partial Match (Missing Ingredients)',
      brand: 'Aspirin 75 Tablet 14',
      mrp: 5.28,
      price: 3.50,
      unit_price: 0.25,
      savings_percent: 33.71,
      link: 'https://www.truemeds.in/aspirin-75',
      details: 'Missing: Enteric coating',
      salts: { 'Aspirin': '75 mg' }
    }
  ];

  test('renders recommended cards side-by-side with correct categories and pricing', () => {
    const onCompareMock = vi.fn();
    render(<Recommendations recommendations={mockRecs} onCompare={onCompareMock} />);

    expect(screen.queryByText('Queried Brand (Standalone)')).toBeNull();
    expect(screen.getByText('Queried Brand (Cheapest Swap)')).toBeInTheDocument();
    expect(screen.getByText('Cheapest Exact Match Alternative')).toBeInTheDocument();
    expect(screen.getByText('Partial Match (Missing Ingredients)')).toBeInTheDocument();
    
    // Check brand name is displayed
    expect(screen.getAllByText('Ecosprin 75 Tablet 14').length).toBe(1);
    expect(screen.getByText('Delisprin 75 Tablet 14')).toBeInTheDocument();
    expect(screen.getByText('Aspirin 75 Tablet 14')).toBeInTheDocument();

    // Check swap instruction details text is rendered with bolding stripped
    expect(screen.getByText('Buy parent Delisprin 75 & swap for Ecosprin 75 in cart')).toBeInTheDocument();

    // Check savings percentages
    expect(screen.queryByText('Save 16%')).toBeNull();
    expect(screen.getAllByText('Save 20%').length).toBe(2); // Cheapest Swap & Cheapest Exact Match
    expect(screen.getByText('Save 34%')).toBeInTheDocument(); // Partial Match

    // Assert that the three Compare buttons are rendered
    expect(screen.getAllByRole('button', { name: 'Compare' }).length).toBe(3);
  });

  test('returns null when recommendations list is empty or missing', () => {
    const { container } = render(<Recommendations recommendations={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
