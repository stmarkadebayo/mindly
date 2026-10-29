# One image serves both the API and the web app.
#   docker build -t mindly .
#   docker run -p 8080:8080 -v mindly-data:/data --env-file .env mindly
# Add --build-arg LOCAL_ASR=1 to include on-server Whisper (large; unnecessary when ASR_API_KEY is set).

# --- build the web app (a static export) ---
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- run the API and serve the built app ---
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 DATA_DIR=/data
WORKDIR /app
COPY requirements.txt requirements-local-asr.txt ./
RUN pip install --no-cache-dir -r requirements.txt
ARG LOCAL_ASR=0
RUN if [ "$LOCAL_ASR" = "1" ]; then pip install --no-cache-dir -r requirements-local-asr.txt; fi
COPY mindly ./mindly
COPY --from=web /web/out ./frontend/out
RUN useradd --create-home app && mkdir /data && chown app /data
USER app
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/config')"
# Platforms that set $PORT (Render, Railway, Cloud Run) are respected; TLS is terminated by the platform's proxy.
CMD ["sh", "-c", "exec uvicorn mindly.main:app --host 0.0.0.0 --port ${PORT:-8080} --proxy-headers --forwarded-allow-ips='*'"]
