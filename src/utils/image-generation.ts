import { bedrockClient, MODEL_IDS, InvokeModelCommand } from '@/lib/aws-config';

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

export function formatImagePrompt(prompt: string): string {
  return `Highly detailed comic book style illustration, ${prompt}, vibrant colors, dynamic poses, sharp outlines, dramatic lighting, sharp shadows, strong ink lines.`;
}

export async function generateImage(
  prompt: string,
  negativePrompt: string,
  seed: number = Math.floor(Math.random() * 1000000)
): Promise<string | null> {
  try {
    console.log('Generating image with prompt:', prompt);
    console.log('Negative prompts:', negativePrompt);

    const command = new InvokeModelCommand({
      modelId: MODEL_IDS.STABLE_DIFFUSION,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        prompt: formatImagePrompt(prompt),
        negative_prompt: negativePrompt,
        seed: seed,
        aspect_ratio: '1:1'
      }),
    });

    const response = await bedrockClient.send(command);
    const responseBody = new TextDecoder().decode(response.body);
    const result = JSON.parse(responseBody);
    console.log('Image generation API response:', result);
    
    if (!result.images?.[0]) {
      throw new Error('No image data in response');
    }

    return result.images[0]; // This is likely a base64-encoded image
  } catch (error) {
    console.error('Error generating image:', error);
    return null;
  }
} 