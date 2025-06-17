export interface ComicPanel {
  id: string;
  imageUrl: string | null;
  description: string;
  prompt: string;
  status: 'pending' | 'completed' | 'error';
}

export interface Character {
  name: string;
  appearance: string;
}

export interface StoryOutline {
  panels: Array<{
    scene: string;
    visualComposition: string;
    lighting: string;
    background: string;
    characters: string[];
    continuityNotes: string;
    poseDetails: string;
    expressions: string;
    motionEffects: string;
    scaleRelationship: string;
    damage: string;
    imagePrompt: string;
    negativePrompt: string;
  }>;
}

export interface GenerationProgress {
  currentPanel: number;
  totalPanels: number;
  status: string;
  progress: number;
}

export interface StoryPrompt {
  title: string;
  description: string;
  numberOfPanels: number;
  style: string;
  theme: string;
}

export interface ComicStory {
  id: string;
  title: string;
  panels: ComicPanel[];
  createdAt: string;
  status: 'draft' | 'generating' | 'completed' | 'error';
} 