from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import queues

app = FastAPI(
    title="Krenox API",
    description="Virtual Queue Management Platform & Discrete Event Simulation API",
    version="0.1.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(queues.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "krenox-backend", "version": "0.1.0"}
