// src/tests/component/HistoryList.test.jsx
import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoryList from '../../components/SearchBar/HistoryList';

describe('HistoryList component', () => {
  test('returns null when history is empty', () => {
    const { container } = render(<HistoryList history={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders list of history items', () => {
    const history = ['dolo', 'ecosprin'];
    render(<HistoryList history={history} />);
    expect(screen.getByText('Search History')).toBeInTheDocument();
    expect(screen.getByText('dolo')).toBeInTheDocument();
    expect(screen.getByText('ecosprin')).toBeInTheDocument();
  });

  test('clicking item triggers onSelectHistoryItem callback', () => {
    const selectSpy = vi.fn();
    const history = ['dolo'];
    render(<HistoryList history={history} onSelectHistoryItem={selectSpy} />);

    const item = screen.getByText('dolo');
    fireEvent.click(item);

    expect(selectSpy).toHaveBeenCalledWith('dolo');
  });

  test('clicking Clear All triggers onClearHistory callback', () => {
    const clearSpy = vi.fn();
    const history = ['dolo', 'ecosprin'];
    render(<HistoryList history={history} onClearHistory={clearSpy} />);

    const clearBtn = screen.getByRole('button', { name: /clear all/i });
    fireEvent.click(clearBtn);

    expect(clearSpy).toHaveBeenCalled();
  });
});
