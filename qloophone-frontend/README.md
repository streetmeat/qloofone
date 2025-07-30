# QlooPhone Frontend

Retro-futuristic landing page for QlooPhone - the voice-based cultural recommendation system powered by Qloo AI.

## Features

- 3D animated QlooPhone logo with Three.js
- Dynamic cultural equation animations (A + B = C recommendations)
- Retro CRT scanline effects
- Click-to-call phone number integration
- Responsive design optimized for all devices

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your phone number
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

## Deployment

Deploy to Vercel:
```bash
./deploy.sh
```

Or manually:
```bash
vercel --prod --env NEXT_PUBLIC_PHONE_NUMBER="(877) 361-7566"
```

## Tech Stack

- Next.js 15.2.4
- React 19
- Three.js + React Three Fiber (3D graphics)
- Tailwind CSS
- Framer Motion (animations)
- TypeScript