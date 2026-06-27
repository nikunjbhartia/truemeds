// src/tests/component/AlternativeCard.test.jsx
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AlternativeCard from '../../components/AlternativeCard';

describe('AlternativeCard component', () => {
  const sub = {
    brand: 'Delisprin 75',
    manufacturer: 'Aristo',
    mrp: 10,
    price: 8,
    unit_price: 0.57,
    savings_percent: 20,
    details: 'Aspirin (75 mg)',
    link: 'https://truemeds.in/delisprin-75'
  };

  test('renders card details and savings badge', () => {
    render(<AlternativeCard sub={sub} isSelected={false} onSelect={() => {}} />);
    
    expect(screen.getByText('Delisprin 75')).toBeInTheDocument();
    expect(screen.getByText('Aristo')).toBeInTheDocument();
    expect(screen.getByText('Save 20%')).toBeInTheDocument();
    expect(screen.getByText('MRP ₹10.00')).toBeInTheDocument();
    expect(screen.getByText('₹8.00')).toBeInTheDocument();
    expect(screen.getByText('₹0.57 / Unit')).toBeInTheDocument();
  });

  test('clicking Select for Swap button triggers onSelect callback', () => {
    const selectSpy = vi.fn();
    render(<AlternativeCard sub={sub} isSelected={false} onSelect={selectSpy} />);

    const selectBtn = screen.getByRole('button', { name: /select for swap/i });
    fireEvent.click(selectBtn);

    expect(selectSpy).toHaveBeenCalled();
  });

  test('renders Selected text when active', () => {
    render(<AlternativeCard sub={sub} isSelected={true} onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /selected/i })).toBeInTheDocument();
  });
});
