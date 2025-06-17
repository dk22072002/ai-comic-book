import { NextResponse } from 'next/server';
import { bedrockClient, MODEL_IDS } from '@/lib/aws-config';
import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, prompt, negative_prompt, seed, aspect_ratio } = body;

    if (type === 'story') {
      const command = new InvokeModelCommand({
        modelId: MODEL_IDS.CLAUDE,
        body: JSON.stringify({
          prompt,
          max_tokens: 4096,
          temperature: 0.7,
          stop_sequences: ['\n\nHuman:'],
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = new TextDecoder().decode(response.body);
      const result = JSON.parse(responseBody);

      return NextResponse.json({ story: result.completion });
    } else if (type === 'image') {
      const command = new InvokeModelCommand({
        modelId: MODEL_IDS.STABLE_DIFFUSION,
        body: JSON.stringify({
          prompt,
          negative_prompt,
          seed,
          aspect_ratio,
        }),
      });

      const response = await bedrockClient.send(command);
      const responseBody = new TextDecoder().decode(response.body);
      const result = JSON.parse(responseBody);
      
      console.log('Raw Bedrock image response:', result);

      if (!result.images || !Array.isArray(result.images) || result.images.length === 0) {
        throw new Error('Invalid response structure from Bedrock');
      }

      return NextResponse.json({ image: result.images[0] });
    } else {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error in generate API:', error);
    if (error.name === 'ValidationException' || error.name === 'BadRequestException') {
      console.error('Bedrock API Error Details:', error.message);
    } else {
      console.error('Full error object:', error);
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 