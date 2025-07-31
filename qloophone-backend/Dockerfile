FROM node:18-alpine

WORKDIR /app

# Copy package files from the backend directory
COPY qloophone-backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source files from the backend directory
COPY qloophone-backend/tsconfig.json ./
COPY qloophone-backend/src ./src

# Install TypeScript for build
RUN npm install -D typescript @types/node

# Build the application
RUN npm run build

# Copy twiml.xml to dist directory (TypeScript doesn't copy non-TS files)
COPY qloophone-backend/src/twiml.xml ./dist/

# Expose port
EXPOSE 8081

# Start the server
CMD ["node", "dist/server.js"]