'use client';

import { useState, ReactNode } from 'react';

export interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children?: ReactNode;
}

export default function TabNavigation({ tabs, activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="tab-navigation">
      <div className="flex flex-wrap gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border-color)]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${activeTab === tab.id
                ? 'bg-[var(--accent-cyan)] text-white shadow-lg shadow-cyan-500/20'
                : tab.disabled
                ? 'text-[var(--text-muted)] cursor-not-allowed'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
              }
            `}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
}

export function TabPanel({ id, activeTab, children }: TabPanelProps) {
  if (id !== activeTab) return null;
  return <div className="tab-panel mt-6">{children}</div>;
}
