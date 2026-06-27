// src/tests/component/SideBySideCompare.test.jsx
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SideBySideCompare from '../../components/SideBySideCompare';

describe('SideBySideCompare Component', () => {
  const refInfo = {
    name: 'Ecosprin 75 Tablet 14',
    manufacturer: 'USV Pvt Ltd',
    pack_form: 'Tablet',
    mrp: 6.5,
    price: 5.2,
    unit_price: 0.37
  };

  const refSalts = {
    'Aspirin': '75 mg',
    'Glycine': '50 mg'
  };

  const compItem = {
    brand: 'Delisprin Gold 75',
    manufacturer: 'Aristo Pharmaceuticals',
    pack_form: 'Tablet',
    mrp: 12.0,
    price: 6.0,
    unit_price: 0.42,
    status: 'Different Strength',
    savings_vs_mrp: 35.0,
    savings_vs_price: -14.0,
    salts: {
      'Aspirin': '75 mg',
      'Glycine': '100 mg',
      'Atorvastatin': '10 mg'
    }
  };

  test('renders side-by-side medicine details, prices, and manufacturer information', () => {
    render(
      <SideBySideCompare
        refInfo={refInfo}
        refSalts={refSalts}
        compItem={compItem}
        onClose={() => {}}
        onSelect={() => {}}
        isSelected={false}
      />
    );

    // Verify brand details
    expect(screen.getByText('Ecosprin 75 Tablet 14')).toBeInTheDocument();
    expect(screen.getByText('USV Pvt Ltd')).toBeInTheDocument();
    expect(screen.getByText('Delisprin Gold 75')).toBeInTheDocument();
    expect(screen.getByText('Aristo Pharmaceuticals')).toBeInTheDocument();

    // Verify prices
    expect(screen.getByText('₹5.20')).toBeInTheDocument();
    expect(screen.getByText('₹6.00')).toBeInTheDocument();

    // Verify savings badges
    expect(screen.getByText('Save 35%')).toBeInTheDocument();
    expect(screen.getByText('+14% Cost')).toBeInTheDocument();
  });

  test('compares salt strengths and extra/missing items correctly', () => {
    render(
      <SideBySideCompare
        refInfo={refInfo}
        refSalts={refSalts}
        compItem={compItem}
        onClose={() => {}}
        onSelect={() => {}}
        isSelected={false}
      />
    );

    // Aspirin matches: 75 mg
    expect(screen.getAllByText('Aspirin')[0]).toBeInTheDocument();
    expect(screen.getByText('75 mg (Match) ✓')).toBeInTheDocument();

    // Glycine differs: 100 mg vs 50 mg
    expect(screen.getAllByText('Glycine')[0]).toBeInTheDocument();
    expect(screen.getByText('100 mg (vs 50 mg) ⚠️')).toBeInTheDocument();

    // Atorvastatin is extra in compItem
    expect(screen.getAllByText('Atorvastatin')[0]).toBeInTheDocument();
    expect(screen.getByText('10 mg (Extra) +')).toBeInTheDocument();
  });

  test('triggers onClose callback when clicking the close button', () => {
    const closeSpy = vi.fn();
    render(
      <SideBySideCompare
        refInfo={refInfo}
        refSalts={refSalts}
        compItem={compItem}
        onClose={closeSpy}
        onSelect={() => {}}
        isSelected={false}
      />
    );

    const closeBtn = screen.getByRole('button', { name: '✕' });
    fireEvent.click(closeBtn);
    expect(closeSpy).toHaveBeenCalled();
  });

  test('triggers onSelect callback when clicking Swap to this Substitute button', () => {
    const selectSpy = vi.fn();
    render(
      <SideBySideCompare
        refInfo={refInfo}
        refSalts={refSalts}
        compItem={compItem}
        onClose={() => {}}
        onSelect={selectSpy}
        isSelected={false}
      />
    );

    const swapBtn = screen.getByRole('button', { name: /swap to this substitute/i });
    fireEvent.click(swapBtn);
    expect(selectSpy).toHaveBeenCalledWith(compItem);
  });
});
