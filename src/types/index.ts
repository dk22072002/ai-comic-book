export interface ComicPanel {
  id: string;
  imageUrl: string | null;
  description: string;
  prompt: string;
  status: 'pending' | 'generating' | 'completed' | 'error';
}

export interface ComicStory {
  id: string;
  title: string;
  panels: ComicPanel[];
  status: 'draft' | 'generating' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface StoryPrompt {
  title?: string;
  description: string;
  numberOfPanels?: number;
  style?: string;
  theme?: string;
}

export interface GenerationProgress {
  currentPanel: number;
  totalPanels: number;
  status: string;
  progress: number;
}

export interface BedrockResponse {
  completion: string;
  stop_reason: string;
  stop: string;
  model: string;
}

export interface CharacterDefinition {
  name: string;
  appearance: string; // Detailed visual description
  base64Image?: string | null; // Optional: Stores the base64 encoded reference image
} 