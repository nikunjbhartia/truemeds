// src/components/ResponsiveLayout.jsx
import React from 'react';

export default function ResponsiveLayout({ children }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full">
      {children}
    </div>
  );
}
