# QlooPhone Deployment Guide

## Overview

QlooPhone operates in two distinct environments with separate phone numbers:

- **Production (Cloud)**: Deployed on Render.com, auto-updates from GitHub
- **Development (Local)**: Runs locally with ngrok tunnel

## Environment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCTION (CLOUD)                      │
├─────────────────────────────────────────────────────────────┤
│  Phone: 1-877-361-7566 (Production Twilio Number)          │
│  Backend: https://qloophone-backend.onrender.com           │
│  Monitor: https://qloophone-monitor.onrender.com           │
│  Auto-deploys: On push to main branch                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT (LOCAL)                      │
├─────────────────────────────────────────────────────────────┤
│  Phone: [Your Dev Twilio Number]                           │
│  Backend: http://localhost:8081 → ngrok tunnel             │
│  Monitor: http://localhost:3001                            │
│  Manual start: npm run dev                                 │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Production Deployment
```bash
# Simply push to main branch
git push origin main

# Render automatically:
# 1. Detects the push via GitHub webhook
# 2. Builds Docker containers
# 3. Deploys backend and monitor
# 4. Updates live services (~5 minutes)
```

### Local Development
```bash
# Terminal 1: Start backend
cd qloophone-backend
npm install
npm run dev

# Terminal 2: Start ngrok tunnel
ngrok http 8081

# Terminal 3: Start monitor (optional)
cd qloophone-monitor
npm install
npm run dev

# Update Twilio dev number webhook to ngrok URL
```

## Detailed Setup Instructions

### 1. Production Environment (Render)

#### Initial Setup (One-time)
1. **Fork/Clone Repository**
   ```bash
   git clone https://github.com/streetmeat/qloofone
   cd qloofone
   ```

2. **Create Render Account**
   - Sign up at https://render.com
   - Connect your GitHub account

3. **Deploy Services**
   ```bash
   # Option A: Use Render Blueprint (Recommended)
   # 1. Go to Render Dashboard
   # 2. Click "New" → "Blueprint"
   # 3. Connect to your repo
   # 4. Select render.yaml
   # 5. Click "Apply"

   # Option B: Manual CLI deployment
   npm install -g @render/cli
   render blueprint deploy
   ```

4. **Configure Environment Variables**
   In Render Dashboard for qloophone-backend:
   ```
   OPENAI_API_KEY=sk-proj-xxxxx
   QLOO_API_KEY=your-qloo-api-key
   ```

5. **Configure Production Twilio Number**
   - Log into Twilio Console
   - Navigate to Phone Numbers → Manage → Active Numbers
   - Select production number (877-361-7566)
   - Set webhook URL: `https://qloophone-backend.onrender.com/twiml`
   - Method: POST

#### Ongoing Deployment
```bash
# All deployments happen automatically!
git add .
git commit -m "Update feature X"
git push origin main

# Monitor deployment:
# 1. Check Render Dashboard for build status
# 2. View logs in Render Dashboard
# 3. Test at https://qloophone-monitor.onrender.com
```

### 2. Development Environment (Local)

#### Prerequisites
- Node.js 18+
- ngrok account (free tier works)
- Twilio account with dev phone number

#### Setup Steps

1. **Install Dependencies**
   ```bash
   # Backend
   cd qloophone-backend
   npm install

   # Monitor
   cd ../qloophone-monitor
   npm install
   ```

2. **Configure Local Environment**
   ```bash
   # Create .env in qloophone-backend
   cat > qloophone-backend/.env << EOF
   OPENAI_API_KEY=sk-proj-xxxxx
   QLOO_API_KEY=your-qloo-api-key
   QLOO_API_URL=https://hackathon.api.qloo.com
   NODE_ENV=development
   PORT=8081
   EOF
   ```

3. **Start Services**
   ```bash
   # Terminal 1: Backend
   cd qloophone-backend
   npm run dev

   # Terminal 2: ngrok tunnel
   ngrok http 8081
   # Note the HTTPS URL (e.g., https://abc123.ngrok.io)

   # Terminal 3: Monitor (optional)
   cd qloophone-monitor
   npm run dev
   ```

4. **Configure Dev Twilio Number**
   - Log into Twilio Console
   - Select your dev phone number
   - Set webhook URL: `https://[your-ngrok-id].ngrok.io/twiml`
   - Method: POST
   - Save

## Environment Variables Reference

### Backend (.env)
```bash
# Required
OPENAI_API_KEY=sk-proj-xxxxx          # OpenAI API key
QLOO_API_KEY=your-key                 # Qloo Hackathon API key

# Optional (defaults shown)
QLOO_API_URL=https://hackathon.api.qloo.com
NODE_ENV=development|production
PORT=8081
PUBLIC_URL=auto-detected              # Render sets this automatically
```

### Monitor (.env.local)
```bash
# Development
NEXT_PUBLIC_BACKEND_URL=http://localhost:8081

# Production (Render auto-configures this)
NEXT_PUBLIC_BACKEND_URL=https://qloophone-backend.onrender.com
```

## Twilio Configuration

### Production Number Setup
1. **Number**: 1-877-361-7566
2. **Webhook**: `https://qloophone-backend.onrender.com/twiml`
3. **Method**: POST
4. **Fallback URL**: (optional) Same URL
5. **Status Callback**: (optional) For call logging

### Development Number Setup
1. **Number**: Your dev Twilio number
2. **Webhook**: `https://[ngrok-id].ngrok.io/twiml`
3. **Method**: POST
4. **Update webhook URL each time ngrok restarts**

### TwiML Response
Both environments return the same TwiML:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say>Please wait while I connect you to QlooPhone.</Say>
    <Connect>
        <Stream url="wss://[backend-host]/call">
            <Parameter name="Cookie" value="[session-cookie]"/>
        </Stream>
    </Connect>
</Response>
```

## Monitoring & Debugging

### Production Monitoring
1. **Render Dashboard**: https://dashboard.render.com
   - View logs, metrics, deployments
   - Check service health
   - Monitor resource usage

2. **QlooPhone Monitor**: https://qloophone-monitor.onrender.com
   - Real-time call transcripts
   - Function call debugging
   - Session configuration

3. **Health Check**: https://qloophone-backend.onrender.com/health

### Local Development Debugging
1. **Backend Logs**: Terminal running `npm run dev`
2. **Monitor UI**: http://localhost:3001
3. **ngrok Inspector**: http://127.0.0.1:4040

## CI/CD Pipeline

### Automatic Deployment Flow
```
Developer pushes to main
    ↓
GitHub webhook triggers
    ↓
Render detects change
    ↓
Docker build starts
    ├── Backend container built
    └── Monitor container built
    ↓
Health checks pass
    ↓
Services go live
    ↓
Old versions shut down
```

### GitHub Actions (Optional)
The repository includes `.github/workflows/render-deploy.yml` for additional automation:
- Runs on push to main
- Performs health checks after deployment
- Can be extended with tests

## Troubleshooting

### Common Issues

1. **"Cannot connect to backend" in Monitor**
   - Check backend is running: `curl http://localhost:8081/health`
   - Verify NEXT_PUBLIC_BACKEND_URL is correct
   - Check for CORS errors in browser console

2. **Twilio call fails immediately**
   - Verify webhook URL is HTTPS (not HTTP)
   - Check ngrok is running and URL is current
   - Confirm Twilio credentials are valid

3. **Render deployment fails**
   - Check Render dashboard for build logs
   - Verify environment variables are set
   - Ensure Dockerfile paths are correct

4. **ngrok tunnel expires**
   - Free tier has 8-hour limit
   - Restart ngrok and update Twilio webhook
   - Consider ngrok paid plan for persistent URLs

### Debug Commands
```bash
# Check production health
curl https://qloophone-backend.onrender.com/health

# Test local WebSocket
wscat -c ws://localhost:8081/call

# View Render logs
render logs qloophone-backend --tail

# Test Twilio webhook
curl -X POST https://qloophone-backend.onrender.com/twiml
```

## Best Practices

1. **Development First**: Test all changes locally before pushing
2. **Monitor Deployments**: Watch Render dashboard during deploys
3. **Use Dev Number**: Never test with production number during development
4. **Environment Isolation**: Keep dev and prod configurations separate
5. **Secure Secrets**: Never commit API keys to repository

## Quick Reference

| Environment | Phone Number | Backend URL | Auto-Deploy |
|------------|--------------|-------------|-------------|
| Production | 1-877-361-7566 | https://qloophone-backend.onrender.com | Yes (on push) |
| Development | Your dev number | http://localhost:8081 + ngrok | No (manual) |

## Support

- **Render Issues**: https://render.com/docs
- **Twilio Support**: https://www.twilio.com/docs
- **ngrok Docs**: https://ngrok.com/docs
- **Project Issues**: https://github.com/streetmeat/qloofone/issues