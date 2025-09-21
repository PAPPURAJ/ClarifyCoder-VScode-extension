from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from uuid import uuid4

app = FastAPI(title="Clarify Service", version="0.0.1")
class AnalyzeRequest(BaseModel):
    artifact_type: Optional[str] = None
    text: str
    mode: Optional[str] = None
class Ambiguity(BaseModel):
    category: str
    message: str
    score: float
class AnalyzeResponse(BaseModel):
    ambiguities: List[Ambiguity]
def heuristic_detect(text: str) -> List[Ambiguity]:
    lower = text.lower()
    hints: List[Ambiguity] = []

    vague_words = [
        "quick", "fast", "soon", "later", "optimize", "clean up", "handle", "support",
        "should", "maybe", "probably", "etc", "tbd", "todo", "edge case", "some", "many"
    ]
    for w in vague_words:
        if w in lower:
            hints.append(Ambiguity(category="vagueness", message=f'Vague term detected: "{w}". What is the precise expectation?', score=0.6))

    import re
    if re.search(r"\b(min|max|limit|timeout|retries)\b", text, re.IGNORECASE) and not re.search(r"\b\d+\b", text):
        hints.append(Ambiguity(category="unspecified-constraint", message="Constraint mentioned without a concrete value. What value should be used?", score=0.7))

    if re.search(r"\bperformance|latency|throughput|memory\b", text, re.IGNORECASE) and not re.search(r"\bms|s|mb|gb|rps\b", text, re.IGNORECASE):
        hints.append(Ambiguity(category="non-functional", message="Non-functional requirement without units. Provide target and units (e.g., 200ms).", score=0.65))

    if re.search(r"\bcompatible|support\b", text, re.IGNORECASE) and re.search(r"\bnode|python|java|browser\b", text, re.IGNORECASE) and not re.search(r"\b\d+\.?\d*\b", text):
        hints.append(Ambiguity(category="compatibility", message="Compatibility mentioned without versions. Which versions must be supported?", score=0.6))

    if re.search(r"\berror|exception|fail\b", text, re.IGNORECASE) and not re.search(r"\bretry|fallback|log|return|throw\b", text, re.IGNORECASE):
        hints.append(Ambiguity(category="error-handling", message="Error scenario mentioned without behavior. What should happen on failure?", score=0.6))

    if not hints:
        hints.append(Ambiguity(category="none", message="No obvious ambiguities detected. Proceed or request specific details if needed.", score=0.2))

    return hints
@app.post("/v1/analyze_context", response_model=AnalyzeResponse)
def analyze_context(req: AnalyzeRequest):
    ambiguities = heuristic_detect(req.text)
    return AnalyzeResponse(ambiguities=ambiguities)

class HealthResponse(BaseModel):
    status: str
    version: str
@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version="0.0.1")
CONVERSATIONS: Dict[str, List[Dict[str, Any]]] = {}
PROJECT_MEMORY: Dict[str, Dict[str, Any]] = {}
class Turn(BaseModel):
    role: str
    content: str
    artifacts: Optional[Dict[str, Any]] = None
class DialogueRequest(BaseModel):
    thread_id: Optional[str] = None
    turn: Turn
    project_id: Optional[str] = "default"
class DialogueResponse(BaseModel):
    thread_id: str
    replies: List[Turn]
    next_actions: List[str]
    memory_updates: List[Dict[str, Any]]
@app.post("/v1/dialogue", response_model=DialogueResponse)
def dialogue(req: DialogueRequest):
    thread_id = req.thread_id or str(uuid4())
    convo = CONVERSATIONS.setdefault(thread_id, [])
    convo.append(req.turn.model_dump())

    ambiguities = heuristic_detect(req.turn.content)
    questions = []
    for a in ambiguities:
        if a.category != "none":
            questions.append(f"{a.message}")
    if not questions:
        questions.append("No obvious ambiguities. Do you want me to proceed with implementation?")

    assistant_reply = Turn(role="assistant", content="\n".join(f"- {q}" for q in questions))
    convo.append(assistant_reply.model_dump())

    return DialogueResponse(
        thread_id=thread_id,
        replies=[assistant_reply],
        next_actions=["ask" if questions else "generate_code"],
        memory_updates=[],
    )
class GenerateCodeRequest(BaseModel):
    thread_id: str
    goal: str
    constraints: Optional[Dict[str, Any]] = None
class GenerateCodeResponse(BaseModel):
    code: str
    rationale: str
    tests: Optional[str] = None
@app.post("/v1/generate_code", response_model=GenerateCodeResponse)
def generate_code(req: GenerateCodeRequest):
    rationale = "Proceeding with placeholder generation. Integrate ClarifyCoder code model here."
    code = f"""
    tests = None
    return GenerateCodeResponse(code=code, rationale=rationale, tests=tests)
class SummarizeRequest(BaseModel):
    project_id: Optional[str] = "default"
    text: str
class SummaryItem(BaseModel):
    category: str
    message: str
    count: int
class SummarizeResponse(BaseModel):
    summary: List[SummaryItem]
@app.post("/v1/summarize_findings", response_model=SummarizeResponse)
def summarize_findings(req: SummarizeRequest):
    hints = heuristic_detect(req.text)
    agg: Dict[str, SummaryItem] = {}
    for h in hints:
        key = f"{h.category}:{h.message}"
        if key not in agg:
            agg[key] = SummaryItem(category=h.category, message=h.message, count=0)
        agg[key].count += 1
    return SummarizeResponse(summary=list(agg.values()))
class MemoryUpsert(BaseModel):
    project_id: Optional[str] = "default"
    key: str
    value: Any
class MemoryEntry(BaseModel):
    key: str
    value: Any
class MemoryListResponse(BaseModel):
    project_id: str
    items: List[MemoryEntry]
@app.get("/v1/memory", response_model=MemoryListResponse)
def list_memory(project_id: str = "default"):
    data = PROJECT_MEMORY.get(project_id, {})
    items = [MemoryEntry(key=k, value=v) for k, v in data.items()]
    return MemoryListResponse(project_id=project_id, items=items)
@app.post("/v1/memory", response_model=MemoryListResponse)
def upsert_memory(up: MemoryUpsert):
    store = PROJECT_MEMORY.setdefault(up.project_id, {})
    store[up.key] = up.value
    items = [MemoryEntry(key=k, value=v) for k, v in store.items()]
    return MemoryListResponse(project_id=up.project_id or "default", items=items)

