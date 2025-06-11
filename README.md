# AI Comic Book Generator

A web application that generates comic books using AWS Bedrock's Claude 3 Sonnet for story generation and Stability Diffusion for image generation.

## Features

- Story generation using Claude 3 Sonnet
- Image generation using Stability Diffusion
- Interactive comic panel preview
- Real-time generation progress
- Export to various formats

## Prerequisites

- Node.js 18+ and npm
- AWS Account with Bedrock access
- AWS CLI configured with appropriate credentials

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-comic-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with your AWS credentials:
```
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## AWS Bedrock Setup

1. Ensure you have access to AWS Bedrock in your AWS account
2. Enable the following models in AWS Bedrock:
   - Claude 3 Sonnet
   - Stability Diffusion XL

## Usage

1. Enter your story details on the create page
2. Choose the number of panels and art style
3. Click "Generate Storyline" to start the generation process
4. Review and edit the generated panels
5. Export your comic book in your preferred format

## Technologies Used

- Next.js 14
- React
- TypeScript
- Tailwind CSS
- AWS Bedrock
- AWS SDK for JavaScript

## License

MIT
