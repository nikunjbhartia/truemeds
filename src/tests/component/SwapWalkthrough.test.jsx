// src/tests/component/SwapWalkthrough.test.jsx
import React from 'react';
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SwapWalkthrough from '../../components/SwapWalkthrough';

describe('SwapWalkthrough component', () => {
  test('renders step numbers and content details', () => {
    render(
      <SwapWalkthrough 
        prescribedName="Ecosprin 75"
        saltsString="Aspirin (75 mg)"
        substituteName="Delisprin 75"
      />
    );
    expect(screen.getByText('Interactive Swap Pathway')).toBeInTheDocument();
    expect(screen.getByText('Ecosprin 75')).toBeInTheDocument();
    expect(screen.getAllByText('Aspirin (75 mg)').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delisprin 75').length).toBeGreaterThan(0);
    
    // Check steps
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
