// src/tests/component/SearchBar.test.jsx
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SearchInput from '../../components/SearchBar/SearchInput';

describe('SearchBar component', () => {
  test('renders title and placeholder', () => {
    render(<SearchInput onSearch={() => {}} history={[]} />);
    expect(screen.getByText('Find Cheaper Medicine Substitutes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter medicine name/)).toBeInTheDocument();
  });

  test('submitting form triggers onSearch with input text', () => {
    const onSearchSpy = vi.fn();
    render(<SearchInput onSearch={onSearchSpy} history={[]} />);

    const input = screen.getByPlaceholderText(/Enter medicine name/);
    fireEvent.change(input, { target: { value: 'Paracetamol' } });
    
    const form = screen.getByRole('textbox').closest('form');
    fireEvent.submit(form);

    expect(onSearchSpy).toHaveBeenCalledWith('Paracetamol');
  });

  test('dropdown history is shown on focus and hidden on blur', async () => {
    const history = ['Dolo', 'Ecosprin'];
    render(<SearchInput onSearch={() => {}} history={history} />);

    const input = screen.getByPlaceholderText(/Enter medicine name/);
    
    // Not visible initially
    expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument();

    // Show on focus
    fireEvent.focus(input);
    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('Dolo')).toBeInTheDocument();

    // Hide on blur (delayed)
    fireEvent.blur(input);
    await waitFor(() => {
      expect(screen.queryByText('Recent Searches')).not.toBeInTheDocument();
    }, { timeout: 300 });
  });

  test('clicking history item triggers onSelectHistoryItem and fills input', () => {
    const selectSpy = vi.fn();
    const history = ['Ecosprin'];
    render(
      <SearchInput 
        onSearch={() => {}} 
        history={history} 
        onSelectHistoryItem={selectSpy} 
      />
    );

    const input = screen.getByPlaceholderText(/Enter medicine name/);
    fireEvent.focus(input);

    const historyItem = screen.getByText('Ecosprin');
    fireEvent.mouseDown(historyItem); // use mouseDown since click will trigger blur first

    expect(selectSpy).toHaveBeenCalledWith('Ecosprin');
    expect(input.value).toBe('Ecosprin');
  });
});
