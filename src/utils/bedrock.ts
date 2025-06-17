import { bedrockClient, MODEL_IDS, InvokeModelCommand } from '@/lib/aws-config';
import { StoryPrompt, Character, StoryOutline } from '@/types';
import { generateImage } from './image-generation';

// Helper function to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function for retry logic
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (retries >= maxRetries || !error.message?.includes('ThrottlingException')) {
        throw error;
      }
      
      console.log(`Retry ${retries + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
      retries++;
    }
  }
}

function cleanClaudeJSON(jsonString: string): string {
  try {
    // First, try to parse it directly
    try {
      return JSON.stringify(JSON.parse(jsonString));
    } catch (parseError) {
      console.log('Direct parsing failed, attempting to clean the JSON');
    }
    
    // Remove any markdown code block markers
    let cleaned = jsonString.replace(/```json\n?|\n?```/g, '');
    
    // Remove any comments
    cleaned = cleaned.replace(/\/\/.*$/gm, '');
    
    // Remove any trailing commas in arrays and objects
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
    
    // Try to parse the cleaned string
    try {
      const parsed = JSON.parse(cleaned);
      return JSON.stringify(parsed);
    } catch (secondError) {
      console.log('First cleaning attempt failed, trying alternative approach');
      
      // Try a different approach: parse the string as a raw string
      try {
        // Convert the string to a raw string by replacing all escaped characters
        const rawString = cleaned
          .replace(/\\n/g, '\n')  // Convert escaped newlines to actual newlines
          .replace(/\\"/g, '"')   // Convert escaped quotes to actual quotes
          .replace(/\\\\/g, '\\'); // Fix double escaped backslashes
        
        // Now try to parse it
        const parsed = JSON.parse(rawString);
        return JSON.stringify(parsed);
      } catch (thirdError) {
        // If all else fails, try one last approach
        console.log('All cleaning attempts failed, trying final approach');
        
        // Try to parse it as a raw string with minimal cleaning
        const finalAttempt = cleaned
          .replace(/\\n/g, '\n')  // Convert escaped newlines to actual newlines
          .replace(/\\"/g, '"')   // Convert escaped quotes to actual quotes
          .replace(/\\\\/g, '\\') // Fix double escaped backslashes
          .replace(/\n/g, '\\n')  // Convert newlines back to escaped newlines
          .replace(/"/g, '\\"');  // Escape all quotes
        
        const parsed = JSON.parse(finalAttempt);
        return JSON.stringify(parsed);
      }
    }
  } catch (error) {
    console.error('Error cleaning JSON:', error);
    console.error('Original string:', jsonString);
    throw error;
  }
}

// Function to format character appearance into a string (robust for string or object)
function formatCharacterAppearance(appearance: any): string {
  if (typeof appearance === 'string') {
    return appearance;
  }
  if (typeof appearance === 'object' && appearance !== null) {
    if (typeof appearance.appearance === 'string') {
      return appearance.appearance;
    }
    if (appearance.keyFeatures) {
      return Object.values(appearance.keyFeatures).filter(Boolean).join(', ');
    }
    if (Array.isArray(appearance.visualAnchors)) {
      return appearance.visualAnchors.join(', ');
    }
  }
  return '';
}

// Function to escape regex special characters
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// Helper to normalize character name for placeholder
function normalizeNameForPlaceholder(name: string) {
  return name.replace(/^The\s+/i, '').trim().toUpperCase().replace(/\s+/g, '_');
}

// Helper to condense a character anchor to N features
function condenseAnchor(description: string, maxFeatures = 5): string {
  return description.split(',').slice(0, maxFeatures).join(',').trim();
}

// Helper to build character anchors/macros
function getCharacterAnchors(characters: Character[]): Record<string, string> {
  const anchors: Record<string, string> = {};
  for (const c of characters) {
    anchors[c.name] = formatCharacterAppearance(c.appearance).trim();
  }
  return anchors;
}

// Helper to add uniqueness phrasing to anchors
function addUniquenessPhrasing(name: string, anchor: string, isFirstPanel: boolean = false): string {
  // Use 'the only' for first panel, 'the same' for subsequent panels
  if (isFirstPanel) {
    return `the only ${name.toLowerCase()}, ${anchor}`;
  } else {
    return `the same ${name.toLowerCase()} from previous panel, ${anchor}`;
  }
}

// Helper to combine character descriptions into a single, vivid sentence
function combineCharacterDescriptions(characters: Character[]): string {
  return characters
    .map(c => {
      const desc = condenseAnchor(formatCharacterAppearance(c.appearance).trim(), 5);
      return `${c.name.toLowerCase()} (${desc})`;
    })
    .join(', ');
}

/**
 * Build a concise prompt for a comic panel: style/action, background, and compact character descriptions.
 * Targets ~400 characters for optimal image generation.
 */
export async function formatPanelWithCharacters(
  panel: any,
  characters: Character[]
): Promise<string> {
  // 1. Style + shot type
  const style = 'Comic book style, dynamic poses, vibrant colors, sharp ink lines, dramatic lighting.';
  const shotType = panel.visualComposition ? `${panel.visualComposition}.` : '';
  const styleShot = `${style} ${shotType}`.trim();

  // 2. Scene with pose and expressions
  const scene = panel.scene || panel.description || '';
  const poseDetails = panel.poseDetails ? `${panel.poseDetails}.` : '';
  const expressions = panel.expressions ? `${panel.expressions}.` : '';
  const sceneWithDetails = `${scene} ${poseDetails} ${expressions}`.trim();

  // 3. Environment and lighting
  const background = panel.background ? `${panel.background}.` : '';
  const lighting = panel.lighting ? `${panel.lighting}.` : '';
  const environment = `${background} ${lighting}`.trim();

  // 4. Character descriptions with scale relationship
  const absent = Array.isArray(panel.absentCharacters) ? panel.absentCharacters : [];
  const presentCharacters = characters.filter(c => !absent.includes(c.name));
  const characterSentence = presentCharacters.length > 0
    ? combineCharacterDescriptions(presentCharacters) + '.'
    : '';
  const scaleRelationship = panel.scaleRelationship ? `${panel.scaleRelationship}.` : '';

  // 5. Motion effects and damage
  const motionEffects = panel.motionEffects ? `${panel.motionEffects}.` : '';
  const damage = panel.damage ? `${panel.damage}.` : '';
  const effects = `${motionEffects} ${damage}`.trim();

  // 6. Final assembly with consistency marker
  let prompt = [
    styleShot,
    sceneWithDetails,
    environment,
    characterSentence,
    scaleRelationship,
    effects,
    'Only one of each character should appear.'
  ].filter(Boolean).join(' ');

  // 7. Trim if much longer than 420 chars (not a hard limit)
  if (prompt.length > 420) {
    console.warn('Prompt exceeds 420 characters:', prompt.length, prompt);
    // Try to preserve the most important elements
    const essentialParts = [
      styleShot,
      sceneWithDetails,
      characterSentence,
      'Only one of each character should appear.'
    ].filter(Boolean).join(' ');
    prompt = essentialParts;
    if (prompt.length > 420) {
      prompt = prompt.slice(0, 420);
      if (!prompt.endsWith('.')) prompt += '.';
    }
  }

  return prompt.trim();
}

export async function extractCharacterDefinitions(storyDescription: string): Promise<Character[]> {
  const prompt = `You are a character designer for a comic book. Identify the main characters in the following story description. For each character, provide a single, vivid sentence describing their appearance.

Story Description:
${storyDescription}

CRITICAL FORMAT REQUIREMENTS - YOUR RESPONSE WILL BE REJECTED IF THESE ARE NOT FOLLOWED:
1. EVERY character description MUST:
   - Start with gender (e.g., "Male," "Female," "Non-binary")
   - Include hair details (e.g., "long black hair," "short curly red hair," "bald")
   - Then list 2-3 other visual traits
2. NO EXCEPTIONS - even for non-human characters:
   - For dragons/creatures: Start with "Creature" or "Beast" instead of gender
   - For robots/constructs: Start with "Construct" or "Machine"
   - For spirits/ghosts: Start with "Spirit" or "Ethereal"
3. Each description MUST be under 100 characters
4. Each description MUST be a single sentence

CORRECT EXAMPLES:
[
  {
    "name": "King",
    "appearance": "Male, long brown beard braided with gold, gold crown with rubies, polished steel armor, crimson cape"
  },
  {
    "name": "Dragon",
    "appearance": "Beast, emerald scales, curved ivory horns, tattered leather wings, orange flame-lit throat"
  }
]

INCORRECT EXAMPLES (DO NOT USE):
{
  "name": "King",
  "appearance": "Gold crown with rubies, polished steel armor, crimson cape, long brown beard braided with gold"
}
{
  "name": "Dragon",
  "appearance": "Emerald scales, curved ivory horns, tattered leather wings, orange flame-lit throat"
}

Output Format:
[
  {
    "name": "Character Name",
    "appearance": "[Gender/Type], [hair/scales/features], [2-3 other visual traits] (≤100 characters)"
  }
]

VALIDATION CHECK:
Before returning your response, verify that:
1. Every description starts with a gender/type identifier
2. Every description includes hair/scales/features
3. No description exceeds 120 characters
4. All descriptions follow the exact format shown in the correct examples`;

  try {
    const response = await invokeClaude(prompt);
    console.log('Raw character definitions response:', response);
    
    const cleanedResponse = cleanClaudeJSON(response);
    const parsedCharacters = JSON.parse(cleanedResponse) as { name: string; appearance: string }[];
    console.log('Successfully parsed character definitions:', parsedCharacters);
    
    // Convert to Character objects with string appearance
    const characters = parsedCharacters.map(char => ({
      name: char.name,
      // Store the string description directly in the appearance field
      // This is safe because the formatter function will handle both string and object types
      appearance: char.appearance as any
    }));
    
    return characters;
  } catch (error) {
    console.error('Error extracting character definitions:', error);
    return [];
  }
}

// Helper to extract key features from a character's appearance string
function extractKeyFeatures(appearance: string): string[] {
  // Skip the first segment (gender/type), then trim and filter
  return appearance
    .split(',')
    .slice(1) // skip the first segment (gender/type)
    .map(f => f.trim())
    .filter(f => f.length > 0);
}

// Helper function to build optimized negative prompts
function buildNegativePrompt(charactersInPanel: { name: string, appearance: string }[]): string {
  const baseNegatives = [
    "photorealistic",
    "blurry",
    "out of frame",
    "inconsistent character design",
    "mutated limbs",
    "wrong costume",
    "floating objects",
    "character facing away from action",
    "overly dark panels",
    "portrait framing",
    "duplicate characters",
    "generic fantasy creatures",
    "generic armor",
    "overgrown dragon heads",
    "alien features",
    "multiple versions of character",
    "inconsistent hairstyle"
  ];

  const characterNegatives = charactersInPanel.flatMap(char => {
    const name = char.name.toLowerCase();
    const features = extractKeyFeatures(char.appearance || '');
    // Debug logging
    console.log(`Appearance for ${char.name}:`, char.appearance);
    console.log(`Features for ${char.name}:`, features);
    const negatives = [
      `inconsistent ${name}`,
      `changing ${name}'s appearance`,
      `changing ${name}'s clothes`,
      `duplicate ${name}`
    ];
    // Add feature-specific negatives
    features.forEach(feature => {
      const mainWord = feature.split(' ').pop();
      if (mainWord && mainWord.length > 2) {
        negatives.push(`changing ${name}'s ${mainWord}`);
        negatives.push(`removing ${name}'s ${mainWord}`);
      }
    });
    return negatives;
  });

  const fullPrompt = [...baseNegatives, ...characterNegatives].join(', ');
  return fullPrompt.length > 500 ? fullPrompt.slice(0, 497) + '...' : fullPrompt;
}

// Update the generateStoryOutline function to pass full character objects for negatives
export async function generateStoryOutline(
  storyDescription: string,
  characters: Character[],
  numPanels: number = 6
): Promise<StoryOutline | null> {
  const characterDescriptions = characters.map(char => 
    `${char.name}: ${char.appearance}`
  ).join('\n\n');

  const prompt = `You are a comic book storyboard artist. Create a story outline for a comic with ${numPanels} panels based on the story description and character definitions. Each panel should be a complete scene that advances the story while maintaining visual consistency.

Story Description:
${storyDescription}

Character Definitions:
${characterDescriptions}

For each panel, provide the following fields:
- scene: A concise summary of the main action and what is happening (1-2 sentences)
- visualComposition: Camera angle, shot type, and spatial layout (e.g., "side view, low angle, dragon in foreground, king in background")
- lighting: Lighting and atmosphere (e.g., "dramatic sunset, orange glow, deep shadows")
- background: Important environment or setting details (e.g., "rocky cliff, stormy sky, castle ruins")
- characters: An array of character names (e.g., ["The King", "The Dragon"]) who are present in this panel
- continuityNotes: Brief notes about visual consistency with previous panels
- poseDetails: Specific pose or action details (e.g., "cape trailing as he dives", "wings spread wide")
- expressions: Character facial expressions and emotions (e.g., "eyes focused, jaw clenched", "snarling, mouth open")
- motionEffects: Visual effects showing movement (e.g., "motion lines show speed", "smoke swirls behind")
- scaleRelationship: Relative size and positioning (e.g., "dragon towering over king", "king small beside massive dragon")
- damage: Any damage or changes to characters (e.g., "dragon's wing torn", "king's armor scorched")
- imagePrompt: A single paragraph prompt for image generation, no more than 420 characters. The prompt must follow this structure:
  1. Style and shot type (e.g., "Comic book style, dynamic aerial composition")
  2. Scene description with pose details and expressions
  3. Environmental details and lighting
  4. Character descriptions - CRITICAL: Use the EXACT character definitions provided above, including gender and hair details
  5. Motion effects and scale relationships
  6. Damage or continuity markers
  7. End with "Only one of each character should appear"

IMPORTANT RULES FOR IMAGE PROMPTS:
- ALWAYS use the complete character descriptions from the Character Definitions section
- NEVER summarize or shorten character descriptions
- Include ALL visual traits (gender, hair, clothing, etc.) for each character
- Keep the total prompt under 420 characters while maintaining all character details

Example of correct character description in image prompt:
"Detective Morgan (Male, salt-pepper hair cropped short, weathered face with stubble, worn brown trenchcoat) examining evidence"

Example of incorrect character description in image prompt:
"Detective Morgan in trenchcoat examining evidence"

Output format (valid JSON):
{
  "panels": [
    {
      "scene": "...",
      "visualComposition": "...",
      "lighting": "...",
      "background": "...",
      "characters": ["Character Name"],
      "continuityNotes": "...",
      "poseDetails": "...",
      "expressions": "...",
      "motionEffects": "...",
      "scaleRelationship": "...",
      "damage": "...",
      "imagePrompt": "..."
    }
  ]
}

CRITICAL RULES:
- Generate EXACTLY ${numPanels} panels - no more, no less
- Output ONLY valid JSON - no comments, questions, or additional text
- Always use the exact same visual description for each character in every panel
- Do NOT paraphrase or shorten character descriptions except as required to fit the 420 character image prompt limit
- Each panel must clearly describe the action, composition, and environment
- Keep character descriptions to 4 strong visual elements maximum
- Use foreground, midground, and background tags to help separate action layers
- The total length of all panel fields must stay under 9000 characters
- Image prompts should be between 380-415 characters for optimal detail vs. model attention`;

  try {
    const response = await invokeClaude(prompt);
    console.log('Raw story outline response:', response);
    
    const cleanedResponse = cleanClaudeJSON(response);
    const storyOutline = JSON.parse(cleanedResponse) as StoryOutline;
    
    // Validate that we have the correct number of panels
    if (!storyOutline.panels || storyOutline.panels.length < numPanels) {
      throw new Error(`Expected ${numPanels} panels but got ${storyOutline.panels?.length || 0}`);
    }
    if (storyOutline.panels.length > numPanels) {
      storyOutline.panels = storyOutline.panels.slice(0, numPanels);
    }

    // Generate optimized negative prompts for each panel using full character objects
    storyOutline.panels = storyOutline.panels.map(panel => {
      const charsInPanel = (panel.characters || []).map(name => {
        const char = characters.find(c => c.name === name) || { name, appearance: '' };
        // Ensure appearance is a string
        let appearanceStr: string;
        if (typeof char.appearance === 'string') {
          appearanceStr = char.appearance;
        } else if (char.appearance && typeof char.appearance === 'object') {
          appearanceStr = JSON.stringify(char.appearance);
        } else {
          appearanceStr = '';
        }
        return { name: char.name, appearance: appearanceStr };
      });
      return {
        ...panel,
        negativePrompt: buildNegativePrompt(charsInPanel)
      };
    }) as StoryOutline['panels'];
    
    console.log('Successfully parsed story outline:', storyOutline);
    return storyOutline;
  } catch (error) {
    console.error('Error generating story outline:', error);
    return null;
  }
}

async function invokeClaude(prompt: string): Promise<string> {
  try {
  const command = new InvokeModelCommand({
    modelId: MODEL_IDS.CLAUDE,
      contentType: 'application/json',
      accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
      messages: [
        {
          role: "user",
            content: prompt
            }
          ]
    }),
  });

  const response = await retryWithBackoff(() => bedrockClient.send(command));
    const responseBody = new TextDecoder().decode(response.body);
    const result = JSON.parse(responseBody);
    
    // For Claude 3.5 Sonnet, the response is in the content field of the first message
    if (!result || !result.content || !result.content[0] || !result.content[0].text) {
      throw new Error('Claude response did not contain expected content field');
    }

    return result.content[0].text;
  } catch (error) {
    console.error('Error invoking Claude:', error);
    throw error;
  }
}

  