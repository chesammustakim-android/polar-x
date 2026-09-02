# ── Stage 1: Build Frontend ──
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY public/ ./public/
COPY src/ ./src/
# Build production bundle with relative API routes
ENV VITE_API_URL=""
RUN npm run build

# ── Stage 2: Production Server ──
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend code and startup script
COPY backend/ ./backend/
COPY start.py .

# Copy pre-built frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 8000

# Start production server
CMD ["python", "start.py"]
