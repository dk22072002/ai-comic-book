import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

// Debug: Log environment variables
console.log('AWS Region:', process.env.AWS_REGION);
console.log('AWS Access Key ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
console.log('AWS Secret Key exists:', !!process.env.AWS_SECRET_ACCESS_KEY);

// AWS Bedrock client configuration
export const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

// Model IDs
export const MODEL_IDS = {
  // Using Claude 3.5 Sonnet which supports the completion API format
  CLAUDE: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  STABLE_DIFFUSION: 'stability.stable-image-ultra-v1:0',
};

// Export the InvokeModelCommand for use in API routes
export { InvokeModelCommand };

// Bedrock API endpoints
export const BEDROCK_ENDPOINTS = {
  INVOKE_MODEL: 'https://bedrock-runtime.us-east-1.amazonaws.com/model/',
}; 