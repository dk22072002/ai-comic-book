'use client';

import { useState } from 'react';
import { Character, StoryOutline } from '@/types';
import { generateStoryOutline, extractCharacterDefinitions, formatPanelWithCharacters } from '@/utils/bedrock';
import { generateImage, formatImagePrompt } from '@/utils/image-generation';
import { ComicPanel, GenerationProgress } from '@/types';
import Image from 'next/image';

interface ProgressData {
  status: string;
  currentPanel: number;
  totalPanels: number;
  progress: number;
}

// Helper function to escape special characters for RegExp
const escapeRegExp = (text: string): string => {
  return text.replace(/[.*+?^${}()|[\\]]/g, '\\$&'); // $& means the whole matched string
};

// Helper to ensure all present character descriptions are in the prompt
function ensureCharacterDescriptionsInPrompt(imagePrompt: string, presentCharacters: { name: string; appearance: any }[]): string {
  let result = imagePrompt;
  presentCharacters.forEach(char => {
    const desc = typeof char.appearance === 'string' ? char.appearance : '';
    if (desc && !result.includes(desc)) {
      result += ` ${char.name}: ${desc}.`;
    }
  });
  return result.trim();
}

// Helper to generate a deterministic seed from a string (e.g., character name)
function hashStringToSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash) % 1000000; // 6 digits
}

// Helper to get a panel seed based on its characters (normalized and sorted)
function getPanelSeed(charNames: string[]): number {
  // Normalize: lowercase, trim, sort
  const normalized = charNames.map(n => n.trim().toLowerCase()).sort();
  if (normalized.length === 0) {
    return Math.floor(Math.random() * 1000000);
  }
  if (normalized.length === 1) {
    return hashStringToSeed(normalized[0]);
  }
  // Combine seeds for multiple characters (sum, then mod)
  return normalized.reduce((acc, name) => acc + hashStringToSeed(name), 0) % 1000000;
}

export default function GeneratePage() {
  const [progress, setProgress] = useState<GenerationProgress>({
    currentPanel: 0,
    totalPanels: 6,
    status: 'Initializing...',
    progress: 0,
  });
  const [panels, setPanels] = useState<ComicPanel[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [description, setDescription] = useState('');
  const [storyOutline, setStoryOutline] = useState<StoryOutline | null>(null);
  const [numPanels, setNumPanels] = useState(6);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleNumPanelsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    // Ensure the value is between 1 and 12
    const validValue = Math.min(Math.max(value, 1), 12);
    setNumPanels(validValue);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate number of panels
    if (numPanels < 1 || numPanels > 12) {
      alert('Please select between 1 and 12 panels');
      return;
    }
    setIsGenerating(true);
    setPanels([]);
    setStoryOutline(null);
    setProgress(prev => ({ ...prev, totalPanels: numPanels, progress: 0, currentPanel: 0 }));
    await generateStory();
  };

  const formatCharacterAppearance = (appearance: any): string => {
    if (typeof appearance === 'string') {
      return appearance;
    }
    // fallback for legacy object structure (shouldn't be needed now)
    return '';
  };

  const generateStory = async () => {
    try {
      setProgress(prev => ({ ...prev, status: 'Extracting characters...' }));
      const characters = await extractCharacterDefinitions(description);
      
      if (!characters || characters.length === 0) {
        setProgress(prev => ({ ...prev, status: 'Error: Failed to extract characters.' }));
        setIsGenerating(false);
        return;
      }

      console.log('Extracted characters:', characters);

      setProgress(prev => ({ ...prev, status: 'Generating story outline...' }));
      const outline = await generateStoryOutline(description, characters, numPanels);
      
      if (!outline) {
        setProgress(prev => ({ ...prev, status: 'Error: Story outline generation failed.' }));
        setIsGenerating(false);
        return;
      }

      setStoryOutline(outline);
      console.log('Story outline:', outline);

      setProgress(prev => ({ ...prev, status: 'Generating images...' }));
      const panelsToGenerate = outline.panels;
      setProgress(prev => ({ ...prev, totalPanels: panelsToGenerate.length }));

      for (let i = 0; i < panelsToGenerate.length; i++) {
        const panel = panelsToGenerate[i] as unknown as {
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
        };
        console.log(`Panel ${i + 1} - panel.imagePrompt:`, panel.imagePrompt);
        
        setProgress(prev => ({
          ...prev,
          currentPanel: i + 1,
          progress: ((i + 1) / panelsToGenerate.length) * 100,
        }));

        // Use deterministic seed for character consistency
        const seed = getPanelSeed(panel.characters);
        // Log the characters and seed for this panel
        console.log(`Panel ${i + 1} - Characters:`, panel.characters, 'Seed:', seed);

        const imageBase64 = await generateImage(
          panel.imagePrompt,
          panel.negativePrompt,
          seed
        );

        setPanels(prev => [...prev, {
          id: `panel-${Date.now()}-${i}`,
          imageUrl: imageBase64 ? `data:image/png;base64,${imageBase64}` : null,
          description: panel.scene,
          prompt: panel.imagePrompt,
          status: 'completed',
        }]);
      }

      // After all panels are generated, log a summary mapping
      console.log('Panel-to-seed mapping:', panelsToGenerate.map((p, i) => ({
        panel: i + 1,
        characters: p.characters,
        normalizedCharacters: p.characters.map(n => n.trim().toLowerCase()).sort(),
        seed: getPanelSeed(p.characters)
      })));

      setProgress(prev => ({ ...prev, status: 'Complete!' }));
      setIsGenerating(false);
    } catch (error) {
      console.error('Error generating story:', error);
      setProgress(prev => ({ ...prev, status: 'Error generating story' }));
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">AI Comic Generator</h1>
        </div>
      </header>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Story Input Form */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Describe Your Comic Story</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Story Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={description}
                  onChange={handleInputChange}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="numPanels" className="block text-sm font-medium text-gray-700">Number of Panels</label>
                <input
                  type="number"
                  id="numPanels"
                  name="numPanels"
                  value={numPanels}
                  onChange={handleNumPanelsChange}
                  min="1"
                  max="12"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isGenerating}
                className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                  ${isGenerating 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                  }`}
              >
                {isGenerating ? 'Generating...' : 'Generate Comic'}
              </button>
            </form>
          </div>
          {/* Progress Section */}
          {isGenerating && (
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">🎨</div>
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  {progress.status}
                </h2>
                <p className="text-gray-600">
                  {progress.currentPanel} of {progress.totalPanels} panels complete
                </p>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress.progress}%` }}
                ></div>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-gray-800 mb-2">Current Process:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex items-center">
                    <span className="mr-2">✅</span>
                    <span>Story outline generated</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">🔄</span>
                    <span>Generating comic panels...</span>
                  </div>
                  <div className="flex items-center">
                    <span className="mr-2">⏳</span>
                    <span>Adding final touches</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          {/* Generated Panels Preview */}
          {panels.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {panels.map((panel) => (
                <div key={panel.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
                  <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-gray-100">
                    {panel.imageUrl ? (
                      <Image
                        src={panel.imageUrl}
                      alt={panel.description}
                        width={512}
                        height={512}
                      className="object-cover w-full h-full"
                    />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-gray-400">
                        <span>Generating image...</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600">{panel.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 