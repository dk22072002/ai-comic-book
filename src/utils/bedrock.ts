import { bedrockClient, MODEL_IDS, InvokeModelCommand } from '@/lib/aws-config';
import { BedrockResponse, StoryPrompt, CharacterDefinition } from '@/types';

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
  // Remove any markdown code block delimiters
  let cleanedString = jsonString.replace(/```(?:json|JOSN|js|javascript|typescript)?\n([\s\S]*?)\n```/g, '$1');
  
  // Find the first occurrence of '{' or '[' and the last occurrence of '}' or ']'
  const startIndex = Math.min(
    cleanedString.indexOf('{') !== -1 ? cleanedString.indexOf('{') : Infinity,
    cleanedString.indexOf('[') !== -1 ? cleanedString.indexOf('[') : Infinity
  );
  const endIndex = Math.max(
    cleanedString.lastIndexOf('}'),
    cleanedString.lastIndexOf(']')
  );

  // If both are found, extract the substring that contains the JSON
  if (startIndex !== Infinity && endIndex !== -1 && endIndex > startIndex) {
    cleanedString = cleanedString.substring(startIndex, endIndex + 1);
    // Remove any trailing content after the last bracket
    const lastBracketIndex = Math.max(
      cleanedString.lastIndexOf('}'),
      cleanedString.lastIndexOf(']')
    );
    if (lastBracketIndex !== -1) {
      cleanedString = cleanedString.substring(0, lastBracketIndex + 1);
    }
    return cleanedString.trim();
  }

  // If a valid JSON structure isn't found, return an empty array string
  console.warn('cleanClaudeJSON: Could not find valid JSON delimiters. Returning empty array string.');
  return '[]';
}

export async function extractCharacterDefinitions(userDescription: string): Promise<CharacterDefinition[] | null> {
  const systemPrompt = `You are an expert in visual storytelling. Analyze the story description below and extract every major character or creature that plays a key visual role. For each, describe the physical appearance in *high visual detail*—including clothing, body type, face, expressions, color schemes, accessories, and anything important for visual consistency.\n\nYour output must be a valid JSON array of objects in this format:\n[\n  {\n    "name": "Character or creature name (e.g., King, Dragon, Princess)",\n    "appearance": "Highly detailed visual description, suitable for comic book illustration."\n  }\n]\n\nOnly include characters that are either mentioned or strongly implied in the prompt.\n\nStory Description:\n"${userDescription}"`;

  console.log('Extracting character definitions with prompt:', userDescription);

  const command = new InvokeModelCommand({
    modelId: MODEL_IDS.CLAUDE,
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: systemPrompt
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.7,
      top_p: 1,
    }),
  });

  const response = await retryWithBackoff(() => bedrockClient.send(command));
  const result = JSON.parse(new TextDecoder().decode(response.body));
  
  // Add a robust check for the expected content structure
  if (!result || !result.content || !Array.isArray(result.content) || !result.content[0] || !result.content[0].text) {
    console.error('Claude response did not contain expected content structure:', result);
    return null; // Return null if the structure is unexpected
  }

  const characterJson = result.content[0].text; // Directly access as we've validated

  console.log('Raw character definitions response:', characterJson);
  let characterDefinitions: CharacterDefinition[] = [];
  try {
    // Log the raw JSON before cleaning
    console.log('Raw JSON before cleaning:', characterJson);
    
    const cleanedCharacterJson = cleanClaudeJSON(characterJson || '');
    console.log('Cleaned JSON:', cleanedCharacterJson);
    
    // Additional cleaning: remove any content after the last valid closing bracket
    const lastBracketIndex = cleanedCharacterJson.lastIndexOf(']');
    const finalJson = lastBracketIndex !== -1 ? cleanedCharacterJson.substring(0, lastBracketIndex + 1) : cleanedCharacterJson;
    console.log('Final JSON to parse:', finalJson);
    
    characterDefinitions = JSON.parse(finalJson) as CharacterDefinition[];
    console.log('Successfully parsed character definitions:', characterDefinitions);
  } catch (e) {
    console.error('Failed to parse character definitions JSON:', e);
    console.error('Problematic JSON string:', characterJson);
    return null;
  }

  // Now, generate a reference image for each character
  for (const char of characterDefinitions) {
    try {
      const portraitPrompt = `Highly detailed comic book style illustration, full-body portrait of ${char.appearance}, neutral pose, white background. Consistent character visuals.`;
      const base64Image = await generateImage(portraitPrompt, []); // Use text-to-image to generate initial portrait
      char.base64Image = base64Image;
      console.log(`Generated reference image for ${char.name}`);
    } catch (e) {
      console.error(`Failed to generate reference image for ${char.name}:`, e);
      // Optionally, you might want to return null here or continue without the image
    }
  }

  return characterDefinitions;
}

export async function generateStoryOutline(prompt: { description: string }, characters: CharacterDefinition[], numPanels: number = 6): Promise<any | null> {
  console.log('Generating story with prompt:', prompt);
  console.log('Identified characters for storyline:', characters);

  const characterDescriptions = characters.map(c => `${c.name}: ${c.appearance}`).join('\n');
  const systemPrompt = `You are a comic writer and visual scene planner for AI-generated comics.\n\nBreak the story described below into ${numPanels} **comic panels**. Each panel should advance the plot meaningfully with clear *actions*, *scene setting*, and *character interactions*. \n\nFor each panel:\n- Write a short but expressive **narrative description** (what happens)\n- Generate a **single-sentence image prompt** for AI image generation, packed with visual cues. This prompt must include:\n  - "Panel X of ${numPanels}." (Replace X with the panel number)\n  - The precise stylistic directives: "Highly detailed comic book style illustration, vibrant colors, dynamic poses, sharp outlines, dramatic lighting."
  - **Full, consistent visual descriptions for ALL recurring characters/creatures from the 'Character Definitions' provided below.** Do NOT assume the model remembers character details from previous prompts or panels.\n  - **Visual anchor phrases for consistency**: "Same [Character Name] as previous panel," "Consistent [Character Name] design with [appearance/key features]" for each character/creature present."
  - Precise character positioning, outfits, lighting, background, and expressions relevant to the panel.\n\nEach panel should logically follow from the previous one. Ensure that the last frame of one panel sets up the action or placement in the next panel. Characters should remain in-frame unless narratively removed, and their consistent presence and appearance are paramount.\n\nAvoid internal thoughts or abstract storytelling—focus only on things that can be drawn.\n\nCharacter Definitions:\n${characterDescriptions}\n\nStory Description:\n"${prompt.description}"\n\nReturn this structure:\n{\n  "panels": [\n    {\n      "description": "Panel story here...",\n      "imagePrompt": "Panel 1 of ${numPanels}. Highly detailed comic book style illustration, vibrant colors, dynamic poses, sharp outlines, dramatic lighting. Full character descriptions here. Visual anchor phrases here. Scene details and character interactions.",\n      "mainCharacterName": "King" // Example: The name of the most visually prominent character in this panel.\n    },\n    {\n      "description": "Panel story here...",\n      "imagePrompt": "Panel 2 of ${numPanels}. Highly detailed comic book style illustration, vibrant colors, dynamic poses, sharp outlines, dramatic lighting. Full character descriptions here. Visual anchor phrases here. Scene details and character interactions.",\n      "mainCharacterName": "King" // Example: The name of the most visually prominent character in this panel.\n    },\n    // ... up to ${numPanels} panels\n  ]\n}`;

  console.log('Sending to Claude:', systemPrompt);

  const command = new InvokeModelCommand({
    modelId: MODEL_IDS.CLAUDE,
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: systemPrompt
            }
          ]
        }
      ],
      max_tokens: 2500,
      temperature: 0.7,
      top_p: 1,
    }),
  });

  const response = await retryWithBackoff(() => bedrockClient.send(command));
  const rawResponseBody = new TextDecoder().decode(response.body); // Decode raw response body
  console.log('Raw Bedrock Response Body (decoded): ', rawResponseBody); // Log it
  const result = JSON.parse(rawResponseBody);
  
  // Safely access rawClaudeText, returning null if content is not as expected
  const rawClaudeText = result.content?.[0]?.text;

  console.log(`Claude raw result (full object): ${JSON.stringify(result, null, 2)}`);
  console.log('Claude result.content:', result.content);
  console.log('Claude result.content[0]:', result.content?.[0]);
  console.log(`Claude response text (result.content[0].text): ${rawClaudeText}`);
  
  let parsedOutline: any = null; // Initialize to null

  try {
    if (rawClaudeText) {
      const cleanedClaudeText = cleanClaudeJSON(rawClaudeText); // Declare locally
      console.log('Cleaned Claude Text (before final parse):', cleanedClaudeText); // Log cleaned text
      parsedOutline = JSON.parse(cleanedClaudeText);
      console.log('Parsed Story Outline:', parsedOutline);
    } else {
      // If rawClaudeText is null or undefined, consider it a parsing failure
      console.warn('Claude returned no text content.');
      parsedOutline = null;
    }
  } catch (e) {
    console.error('Failed to parse or clean story outline JSON:', e);
    console.error('Raw Claude text that failed to parse:', rawClaudeText); // Log problematic raw text
    parsedOutline = null; // Set to null on any parsing/cleaning error
  }

  return parsedOutline; // Return the parsed object or null
}

export async function generateImage(prompt: string, additionalNegativePrompts: string[] = [], initImage?: string, strength: number = 0.7): Promise<string | null> {
  console.log('Generating image with prompt:', prompt);
  console.log('Using initImage:', !!initImage);
  console.log('Image strength:', strength);

  const baseNegativePrompts = [
    "photorealistic, blurry, low quality, distorted, deformed, inconsistent characters, inconsistent settings, text, watermark, bad anatomy, ugly, tiling, poorly drawn, out of frame, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, grayscale, black and white, blurry, cloned face, duplicate, extra limbs, mutated, gross, disgusting"
  ];

  const combinedNegativePrompts = [...baseNegativePrompts, ...additionalNegativePrompts].join(', ');

  const requestBody: any = {
    prompt: prompt,
    negative_prompt: combinedNegativePrompts,
    seed: Math.floor(Math.random() * 1000000),
    output_format: "png",
  };

  if (initImage) {
    requestBody.mode = "image-to-image";
    requestBody.image = initImage;
    requestBody.strength = strength;
  } else {
    requestBody.mode = "text-to-image";
    requestBody.aspect_ratio = "1:1";
  }

  const command = new InvokeModelCommand({
    modelId: MODEL_IDS.STABLE_DIFFUSION,
    body: JSON.stringify(requestBody),
  });

  // Add delay between image generation requests
  await delay(2000); // 2 second delay

  const response = await retryWithBackoff(() => bedrockClient.send(command));
  const result = JSON.parse(new TextDecoder().decode(response.body));

  console.log('Stable Diffusion raw result (full object):', JSON.stringify(result, null, 2));

  // Check if images array exists and has at least one image
  if (!result || !result.images || !Array.isArray(result.images) || result.images.length === 0) {
    console.error('Stable Diffusion response did not contain expected images array:', result);
    return null;
  }

  console.log('Stable Diffusion response received');
  return result.images[0];
}

export function formatImagePrompt(prompt: string): string {
  // Claude is now responsible for generating the full, detailed prompt with style and character info.
  // This function simply returns the prompt as is.
  console.log('Formatted image prompt (final):', prompt);
  return prompt;
} 