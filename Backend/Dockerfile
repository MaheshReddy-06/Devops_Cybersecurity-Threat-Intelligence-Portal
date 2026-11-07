# =============================================================================
# Backend Dockerfile: Node.js Express REST API
# =============================================================================
FROM node:20-alpine

# Install curl for container health check probes
RUN apk add --no-cache curl

# Set application working directory inside container
WORKDIR /app

# Copy package dependency manifests
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application source code
COPY . .

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose backend API port
EXPOSE 5000

# Health check to ensure /api/health responds with 200 OK
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start the Express server
CMD ["node", "server.js"]
