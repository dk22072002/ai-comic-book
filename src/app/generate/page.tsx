'use client';

import { useState } from 'react';
import { generateStoryOutline, generateImage, formatImagePrompt, extractCharacterDefinitions } from '@/utils/bedrock';
import { ComicPanel, GenerationProgress } from '@/types';

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
  const [storyOutline, setStoryOutline] = useState<any>(null);
  const [numPanels, setNumPanels] = useState(6);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
  };

  const handleNumPanelsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumPanels(Number(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setPanels([]);
    setStoryOutline(null);
    setProgress(prev => ({ ...prev, totalPanels: numPanels, progress: 0, currentPanel: 0 }));
    await generateStory();
  };

  const generateStory = async () => {
    try {
      setProgress(prev => ({ ...prev, status: 'Extracting characters...' }));
      const characters = await extractCharacterDefinitions(description);
      
      if (characters === null) {
        setProgress(prev => ({ ...prev, status: 'Error: Failed to extract characters.' }));
        setIsGenerating(false);
        return; // Stop the generation process
      }

      // Generate character-specific negative prompts dynamically
      const characterNegativePrompts = characters.flatMap(char => [
        `inconsistent ${char.name.toLowerCase()}`,
        `changing ${char.name.toLowerCase()}'s appearance`,
        `changing ${char.name.toLowerCase()}'s clothes`,
        `changing ${char.name.toLowerCase()}'s crown` // This can be generalized further if needed
      ]);

      console.log('Extracted characters:', characters);
      console.log('Character-specific negative prompts:', characterNegativePrompts);

      setProgress(prev => ({ ...prev, status: 'Generating story outline...' }));
      const storyPrompt = {
        description,
      };
      const outline = await generateStoryOutline(storyPrompt, characters!, numPanels);
      
      if (outline === null) {
        setProgress(prev => ({ ...prev, status: 'Error: Story outline generation failed.' }));
        setIsGenerating(false);
        return; // Stop the generation process
      }

      const parsedOutline = outline; // Directly assign the object
      setStoryOutline(parsedOutline);

      console.log('parsedOutline before panel access:', parsedOutline); // Added for debugging

      // Validate the structure of the parsed outline
      if (!parsedOutline || !Array.isArray(parsedOutline.panels)) {
        setProgress(prev => ({ ...prev, status: 'Error: Invalid story outline structure.' }));
        setIsGenerating(false);
        return; // Stop the generation process
      }

      setProgress(prev => ({ ...prev, status: 'Generating images...' }));
      const panelsToGenerate = parsedOutline.panels || [];
      setProgress(prev => ({ ...prev, totalPanels: panelsToGenerate.length }));

      for (let i = 0; i < panelsToGenerate.length; i++) {
        const panel = panelsToGenerate[i];
        const imagePrompt = formatImagePrompt(panel.imagePrompt);
        
        // Find the main character's reference image
        const mainCharacter = characters.find(char => char.name === panel.mainCharacterName);
        const initImage = mainCharacter?.base64Image || undefined;

        setProgress(prev => ({
          ...prev,
          currentPanel: i + 1,
          progress: ((i + 1) / panelsToGenerate.length) * 100,
        }));
        const imageBase64 = await generateImage(imagePrompt, characterNegativePrompts, initImage, 0.7);
        setPanels(prev => [...prev, {
          id: `panel-${Date.now()}-${i}`,
          imageUrl: imageBase64 ? `data:image/png;base64,${imageBase64}` : null,
          description: panel.description,
          prompt: imagePrompt,
          status: 'completed',
        }]);
      }
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
                  max="10"
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
                  <div className="aspect-w-16 aspect-h-9">
                    <img
                      src={panel.imageUrl || ''}
                      alt={panel.description}
                      className="object-cover w-full h-full"
                    />
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