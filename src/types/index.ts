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

export interface Character {
  name: string;
  appearance: {
    face?: {
      hair?: {
        color?: string;
        length?: string;
        style?: string;
        texture?: string;
        uniqueFeatures?: string;
      };
      eyes?: {
        color?: string;
        shape?: string;
        size?: string;
        distinctiveFeatures?: string;
      };
      nose?: {
        shape?: string;
        size?: string;
        uniqueCharacteristics?: string;
      };
      faceShape?: {
        jawline?: string;
        cheekbones?: string;
        forehead?: string;
      };
      facialFeatures?: {
        scars?: string;
        typicalExpression?: string;
        wrinkles?: string;
      };
    };
    body?: {
      height?: string;
      weight?: string;
      build?: string;
      posture?: {
        howTheyStand?: string;
        characteristicPoses?: string;
        physicalLimitations?: string;
      };
      age?: string;
      physicalDistinguishingFeatures?: string;
    };
    clothing?: {
      robe?: {
        color?: string;
        material?: string;
        length?: string;
        details?: string;
      };
      armor?: {
        material?: string;
        color?: string;
        details?: string;
        thickness?: string;
      };
      // Add other clothing items as needed
    };
    accessories?: {
      staff?: {
        height?: string;
        material?: string;
        crystal?: string;
      };
      sword?: {
        length?: string;
        blade?: string;
        hilt?: string;
      };
      shield?: {
        shape?: string;
        size?: string;
        colors?: string;
      };
      // Add other accessories as needed
    };
  };
  visualAnchors?: string[];
  keyFeatures?: {
    face: string;
    body: string;
    clothing: string;
    accessories: string;
  };
}

export interface StoryOutline {
  panels: {
    description: string;
    imagePrompt: string;
    continuityNotes: string;
    visualComposition: string;
    lighting: string;
    background: string;
    characters: string[];
    poseDetails: string;
    expressions: string;
    motionEffects: string;
    scaleRelationship: string;
    damage: string;
  }[];
} 