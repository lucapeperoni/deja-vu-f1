from fastapi import FastAPI
from app.db.base import engine, Base
from app.db.models import core

# Create tables for now (in production, use alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Race Dynamics Data Layer API",
    description="Internal API for Race Dynamics Information Visualization",
    version="0.1.0",
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "race_dynamics_data_layer"}
