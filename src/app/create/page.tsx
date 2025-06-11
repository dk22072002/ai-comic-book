'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StoryPrompt } from '@/types';

export default function CreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState<StoryPrompt>({
    title: '',
    description: '',
    numberOfPanels: 4,
    style: 'comic book',
    theme: 'adventure',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement story generation
    router.push('/generate');
  };

  const systemPrompt = `
You are a creative comic book writer.
Your task is to generate a detailed comic book storyline, split into 4 panels, based ONLY on the following user description.
Do not invent unrelated characters, settings, or plot points.
Every panel must be directly related to the user's description.

User description: ${prompt.description}

Return a JSON object with this structure:
{
  "panels": [
    { "description": "Panel 1 description", "imagePrompt": "Panel 1 image prompt" },
    ...
  ]
}
`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">Create Your Comic Story</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Title
                </label>
                <input
                  type="text"
                  value={prompt.title}
                  onChange={(e) => setPrompt({ ...prompt, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your story title"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Story Description
                </label>
                <textarea
                  value={prompt.description}
                  onChange={(e) => setPrompt({ ...prompt, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32"
                  placeholder="Describe your comic story idea..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Panels
                </label>
                <select
                  value={prompt.numberOfPanels}
                  onChange={(e) => setPrompt({ ...prompt, numberOfPanels: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {[4, 6, 8, 12].map((num) => (
                    <option key={num} value={num}>
                      {num} Panels
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Art Style
                </label>
                <select
                  value={prompt.style}
                  onChange={(e) => setPrompt({ ...prompt, style: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="comic book">Comic Book</option>
                  <option value="manga">Manga</option>
                  <option value="cartoon">Cartoon</option>
                  <option value="realistic">Realistic</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Theme
                </label>
                <select
                  value={prompt.theme}
                  onChange={(e) => setPrompt({ ...prompt, theme: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="adventure">Adventure</option>
                  <option value="fantasy">Fantasy</option>
                  <option value="sci-fi">Sci-Fi</option>
                  <option value="mystery">Mystery</option>
                </select>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Tips for Better Results</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Describe main characters and their appearance</li>
                  <li>• Mention the setting and time period</li>
                  <li>• Include the mood and genre</li>
                  <li>• Be specific about key scenes and actions</li>
                </ul>
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Generate Storyline ✨
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 