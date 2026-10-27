# Multi-stage / clean production Dockerfile for PackSignal
FROM node:24-bookworm-slim

# Install system dependencies including Python 3, venv, and imaging utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    python3-pip \
    curl \
    ca-certificates \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Create dedicated virtual environment for Python dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PACKPROOF_PYTHON="/opt/venv/bin/python3"

# Install Python dependencies first for caching
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Install Node dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy application source code
COPY . .

# Build assets if needed (Three.js bundle is already checked into public/three-bundle.js)
# Ensure persistent data directory exists
RUN mkdir -p /data && chown -R node:node /data /app

# Configure environment
ENV NODE_ENV=production
ENV PORT=4173
ENV PACKPROOF_DATA_DIR=/data
ENV GEMINI_MODEL=gemini-3.8-flash

# Expose web service port
EXPOSE 4173

# Switch to unprivileged user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4173/api/status || exit 1

# Start PackSignal server
CMD ["npm", "start"]
