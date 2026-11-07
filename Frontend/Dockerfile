# =============================================================================
# Stage 1: Build React Application using Node.js
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies (cached when package files don't change)
COPY package*.json ./
RUN npm ci || npm install

# Build argument for backend API URL (embedded into static client assets)
ARG VITE_API_URL=http://localhost:5000/api
ENV VITE_API_URL=$VITE_API_URL

# Copy frontend source files and compile production bundle
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: Serve Production Assets using Lightweight Nginx Web Server
# =============================================================================
FROM nginx:alpine

# Copy custom Nginx configuration (React Router SPA routing + /api reverse proxy)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy static assets from build stage to Nginx web root
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP service port
EXPOSE 80

# Health check to ensure web server is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:80/ || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
