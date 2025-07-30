#!/bin/bash

# Deploy QlooPhone landing page to Vercel

echo "🚀 Deploying QlooPhone to Vercel..."

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm i -g vercel
fi

# Set environment variable
export NEXT_PUBLIC_PHONE_NUMBER="(877) 361-7566"

echo "📞 Phone number set to: $NEXT_PUBLIC_PHONE_NUMBER"

# Deploy with Vercel
echo "🔧 Starting deployment..."
vercel --prod \
  --env NEXT_PUBLIC_PHONE_NUMBER="(877) 361-7566" \
  --name qloophone \
  --yes

echo "✅ Deployment complete!"
echo "📱 Visit your app at the URL provided above"