// src/tests/adversarial/app-adversarial.test.jsx
import React from 'react';
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../App';
import { installFetchMock } from '../helpers/mock-fetch';

describe('Adversarial UI: App.jsx and storage vulnerabilities', () => {
  let fetchMock;

  beforeEach(() => {
    window.localStorage.clear();
    window.location.search = '';
  });

  afterEach(() => {
    fetchMock?.restore();
    vi.restoreAllMocks();
  });


  test('handles malicious URL query strings safely without script execution', async () => {
    // Inject script tag into search query parameter
    window.location.search = '?search=%3Cscript%3Ealert(%22xss%22)%3C/script%3E';
    
    // Install fetch mock so search doesn't crash on network throw and returns a mock product
    fetchMock = installFetchMock({
      routeMap: {
        '<script>alert("xss")</script>': {
          '1': {
            responseData: {
              elasticProductDetails: [
                {
                  product: {
                    productCode: 'xss-code',
                    brandName: "<script>alert('xss-brand')</script>",
                    manufacturerName: 'Hackers Ltd',
                    available: true,
                    saltComposition: 'XSS Salt (10mg)',
                    composition: 'XSS Salt (10mg)',
                    sellingPrice: 10,
                    mrp: 10,
                    packSize: 1
                  },
                  suggestion: null
                }
              ]
            }
          }
        },
        'XSS Salt': {
          '1': {
            responseData: {
              elasticProductDetails: []
            }
          }
        }
      }
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Render App
    render(<App />);

    // Assert that the brand name is rendered exactly as text in a level 3 heading
    const element = await screen.findByRole('heading', { level: 3, name: /xss-brand/ });
    expect(element).toBeInTheDocument();
    expect(element.textContent).toBe("<script>alert('xss-brand')</script>");

    consoleSpy.mockRestore();
  });
});
