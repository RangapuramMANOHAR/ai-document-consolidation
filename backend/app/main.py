"""FastAPI application entry point."""

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import analytics, export, invoices, upload

app = FastAPI(title="Document Scanner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
app.include_router(upload.router, tags=["upload"])
app.include_router(export.router, tags=["export"])


@app.get("/health")
def health():
    """Health check endpoint."""
    return {"status": "ok"}
