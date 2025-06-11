import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">🎨 AI Comic Book Generator</h1>
          <p className="text-xl opacity-90">Create amazing comic books using AI</p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4">📚</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Comic Creator</h2>
              <p className="text-gray-600">Choose how you want to start your comic book journey</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-1 mb-8">
              <div className="grid grid-cols-2 gap-2">
                <button className="bg-blue-600 text-white py-3 px-6 rounded-lg font-medium">
                  📝 Text Prompt
                </button>
                <button className="bg-white text-gray-700 py-3 px-6 rounded-lg font-medium">
                  ✏️ Draw & Write
                </button>
              </div>
            </div>

            <Link 
              href="/create"
              className="block w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-center py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              Get Started →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
