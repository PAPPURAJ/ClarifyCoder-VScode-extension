# Clarify Service (FastAPI)

Minimal service that analyzes text and returns ambiguity suggestions.

## Run (local dev)
```bash
cd "github repo/clarify-service"
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Endpoints
- GET `/health`
  - Response: `{ "status": "ok", "version": "0.0.1" }`

- POST `/v1/analyze_context`
  - Body: `{ "text": "...", "artifact_type": "optional", "mode": "optional" }`
  - Response: `{ "ambiguities": [ { "category", "message", "score" } ] }`

- POST `/v1/dialogue`
  - Body: `{ "thread_id?": "string", "turn": { "role": "user|assistant", "content": "...", "artifacts?": {} }, "project_id?": "string" }`
  - Response: `{ "thread_id": "string", "replies": [ {"role","content"} ], "next_actions": ["ask"|"generate_code"], "memory_updates": [] }`

- POST `/v1/generate_code`
  - Body: `{ "thread_id": "string", "goal": "...", "constraints?": {} }`
  - Response: `{ "code": "...", "rationale": "...", "tests?": "..." }`

- POST `/v1/summarize_findings`
  - Body: `{ "text": "...", "project_id?": "string" }`
  - Response: `{ "summary": [ { "category", "message", "count" } ] }`

- GET `/v1/memory?project_id=default`
  - Response: `{ "project_id": "default", "items": [ { "key", "value" } ] }`

- POST `/v1/memory`
  - Body: `{ "project_id?": "default", "key": "...", "value": any }`
  - Response: `{ "project_id": "default", "items": [ ... ] }`

## Docker

### Build and run with Docker
```bash
cd "github repo/clarify-service"
docker build -t clarify-service:local .
docker run -d --name clarify-service -p 8001:8001 --restart unless-stopped clarify-service:local
```
Service will be available at `http://localhost:8001`.

### Using docker-compose
```bash
cd "github repo/clarify-service"
docker compose up -d --build
```

### Health check
```bash
curl http://localhost:8001/health
```

## Notes
- Currently uses heuristics. Replace `heuristic_detect` with ClarifyCoder model calls later.
