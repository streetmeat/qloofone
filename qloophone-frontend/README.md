# QlooPhone Frontend

Marketing landing page for QlooPhone featuring animated 3D branding and service information.

## Overview

The frontend serves as the public-facing website that:
- Introduces the QlooPhone service
- Displays the phone number prominently
- Shows example interactions
- Features animated 3D logo
- Provides retro-futuristic aesthetic

## Features

### 3D Animated Logo
- Three.js powered Qloofone text
- Continuous rotation animation
- Retro wireframe aesthetic
- Responsive sizing

### Hero Section
- Large phone number display
- Clear value proposition
- Call-to-action messaging
- Nostalgic design elements

### Example Scenarios
- Rotating example recommendations
- Visual problem/solution format
- Diverse use case demonstrations

## Installation

```bash
cd qloophone-frontend
npm install
```

## Running

### Development
```bash
npm run dev
# Opens at http://localhost:3000
```

### Production Build
```bash
npm run build
npm start
```

## Architecture

### Project Structure

```
app/
├── page.tsx              # Main landing page
├── layout.tsx           # Root layout
└── globals.css         # Global styles

components/
├── animated-scenarios.tsx    # Rotating examples
├── qloofone-logo.tsx        # 3D logo component
├── theme-provider.tsx       # Theme context
└── ui/                      # shadcn/ui components

fonts/
└── helvetiker_bold.typeface.json  # 3D text font

styles/
└── globals.css         # Tailwind configuration
```

### Key Technologies

- **Next.js 15**: React framework
- **Three.js**: 3D graphics
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Three.js helpers
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library

## Components

### QloofoneLogo

3D animated logo using Three.js:

```typescript
<Canvas camera={{ position: [0, 0, 10] }}>
  <Text3D
    font="/fonts/helvetiker_bold.typeface.json"
    size={1.2}
    height={0.2}
  >
    Qloofone
  </Text3D>
</Canvas>
```

Features:
- Custom font loading
- Continuous rotation
- Responsive scaling
- WebGL optimization

### AnimatedScenarios

Rotating display of example use cases:

```typescript
const scenarios = [
  {
    problem: "Date night paralysis",
    solution: "Star Wars + Pride & Prejudice = The Princess Bride"
  },
  // ... more scenarios
]
```

Features:
- Automatic rotation every 4 seconds
- Smooth fade transitions
- Pause on hover
- Mobile responsive

## Styling

### Design System

- **Colors**: 
  - Primary: Qloo brand blue (#0066CC)
  - Background: Dark charcoal (#1A1A1A)
  - Accent: Retro green (#00FF00)

- **Typography**:
  - Headers: System font stack
  - Body: Inter or system sans-serif
  - 3D: Helvetiker Bold

- **Effects**:
  - CRT-style animations
  - Subtle gradients
  - Neon glow effects

### Responsive Design

Breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## Performance Optimization

### 3D Rendering
- Lazy load Three.js components
- Optimize polygon count
- Use simple materials
- Enable antialiasing only on desktop

### Page Load
- Next.js automatic code splitting
- Image optimization
- Font preloading
- Minimal JavaScript bundle

## SEO Optimization

### Meta Tags
```html
<title>QlooPhone - AI Recommendations by Phone</title>
<meta name="description" content="Call 1-877-361-7566..." />
<meta property="og:image" content="/og-image.png" />
```

### Structured Data
- Organization schema
- Service schema
- FAQ schema (if applicable)

## Deployment

### Environment Variables

None required for frontend-only deployment.

### Build Configuration

```javascript
// next.config.mjs
module.exports = {
  output: 'standalone',
  images: {
    domains: ['qloo.com'],
  },
}
```

### Vercel Deployment

```bash
./deploy.sh
```

Or manually:
```bash
vercel --prod
```

## Content Management

### Updating Examples

Edit `animated-scenarios.tsx`:

```typescript
const scenarios = [
  {
    problem: "Your scenario",
    solution: "Your solution"
  }
]
```

### Modifying Phone Number

Update in `page.tsx`:

```typescript
const PHONE_NUMBER = "1-877-361-7566"
```

## Analytics

Consider adding:
- Google Analytics 4
- Hotjar for heatmaps
- Call tracking metrics

## A/B Testing

Potential test variations:
- CTA button text
- Hero messaging
- Example scenarios
- Color schemes

## Accessibility

- ARIA labels on interactive elements
- Keyboard navigation support
- Screen reader compatibility
- Color contrast compliance
- Reduced motion options

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers

WebGL required for 3D logo.

## Future Enhancements

1. **Interactive Demo**: Simulated call experience
2. **Testimonials**: User success stories
3. **FAQ Section**: Common questions
4. **Multi-language**: Spanish, French support
5. **Dark/Light Mode**: Theme toggle

## Troubleshooting

### 3D Logo Not Showing

1. Check WebGL support
2. Verify font file loading
3. Check browser console for errors
4. Try disabling ad blockers

### Slow Performance

1. Reduce 3D complexity
2. Enable production mode
3. Check network latency
4. Profile with Chrome DevTools

### Build Errors

1. Clear `.next/` directory
2. Delete `node_modules/`
3. Run `npm install` fresh
4. Check Node.js version

## Tech Stack

- Next.js 15.2.4
- React 19
- Three.js + React Three Fiber (3D graphics)
- Tailwind CSS
- TypeScript