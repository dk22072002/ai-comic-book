import { NextResponse } from 'next/server';
import { bedrockClient, MODEL_IDS, InvokeModelCommand } from '@/lib/aws-config';
import { StoryPrompt } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, type } = body;

    if (type === 'story') {
      const command = new InvokeModelCommand({
        modelId: MODEL_IDS.CLAUDE,
        body: JSON.stringify({
          prompt: prompt,
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 1,
          stop_sequences: ['\n\n'],
        }),
      });

      const response = await bedrockClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      return NextResponse.json({ result: result.completion });
    }

    if (type === 'image') {
      const command = new InvokeModelCommand({
        modelId: MODEL_IDS.STABLE_DIFFUSION,
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 10,
          steps: 50,
          width: 1024,
          height: 1024,
        }),
      });

      const response = await bedrockClient.send(command);
      const result = JSON.parse(new TextDecoder().decode(response.body));
      return NextResponse.json({ result: result.artifacts[0].base64 });
    }

    return NextResponse.json(
      { error: 'Invalid request type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in generate API:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 