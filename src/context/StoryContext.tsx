'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { StoryPrompt, ComicPanel, ComicStory } from '@/types';

interface StoryContextType {
  storyPrompt: StoryPrompt | null;
  setStoryPrompt: (prompt: StoryPrompt) => void;
  panels: ComicPanel[];
  setPanels: (panels: ComicPanel[]) => void;
  currentStory: ComicStory | null;
  setCurrentStory: (story: ComicStory) => void;
}

const StoryContext = createContext<StoryContextType | undefined>(undefined);

export function StoryProvider({ children }: { children: ReactNode }) {
  const [storyPrompt, setStoryPrompt] = useState<StoryPrompt | null>(null);
  const [panels, setPanels] = useState<ComicPanel[]>([]);
  const [currentStory, setCurrentStory] = useState<ComicStory | null>(null);

  return (
    <StoryContext.Provider
      value={{
        storyPrompt,
        setStoryPrompt,
        panels,
        setPanels,
        currentStory,
        setCurrentStory,
      }}
    >
      {children}
    </StoryContext.Provider>
  );
}

export function useStory() {
  const context = useContext(StoryContext);
  if (context === undefined) {
    throw new Error('useStory must be used within a StoryProvider');
  }
  return context;
} 