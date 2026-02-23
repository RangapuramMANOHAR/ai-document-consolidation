AI Document Consolidation System

An AI-powered full-stack application that extracts structured invoice data from unstructured documents and generates real-time analytics.

This system supports multi-format uploads (PDF, images, CSV/XLSX, ZIP bundles), performs OCR + LLM-based parsing, validates extracted fields, stores data in PostgreSQL, and provides a KPI dashboard for analytics.

🚀 Features
📂 Multi-Format Upload

PDF

JPG / PNG

CSV / XLSX

ZIP bundles (auto-extracts and processes each file)

🧠 Intelligent Extraction Pipeline

OCR for text extraction (PDF/Image)

LLM-based structured parsing (Groq API)

Validation layer for critical fields

Fallback rule-based extraction if needed

🗄 Structured Storage

PostgreSQL (Supabase)

Clean repository/service architecture

Validation before persistence

📊 KPI Dashboard

Total invoices processed

Total consolidated amount

Breakdown by processing status

Breakdown by currency

Top vendors

Daily totals (last 14 days)

🔎 Invoice Review Interface

Search by vendor or invoice number

Filter by status

Filter by currency

Clear status badges (SUCCESS / PARTIAL / FAILED)

🏗 Architecture Overview
Tech Stack

Frontend

React (Vite)

Custom CSS (Professional SaaS layout)

Backend

FastAPI

Uvicorn

Repository + Service layer architecture

Database

PostgreSQL (Supabase)

AI & Processing

OCR for raw text extraction

Groq LLM for structured JSON parsing

Validation layer to ensure data integrity

🔄 Processing Workflow

Upload → File Type Detection → OCR (if needed) →
LLM Parsing → Validation → Database Storage → Analytics

The system ensures required fields (invoice number, total amount, etc.) are validated before marking an invoice as SUCCESS.

📁 Project Structure
DocumentScanner/
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── adapters/
│   │   └── main.py
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── index.css
🛠 Local Setup
1️⃣ Clone Repository
git clone https://github.com/your-username/ai-document-consolidation.git
cd ai-document-consolidation
2️⃣ Backend Setup
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

Create .env inside backend/:

DATABASE_URL=your_postgres_connection_string
GROQ_API_KEY=your_groq_api_key

Run backend:

uvicorn app.main:app --reload

Backend runs at:

http://127.0.0.1:8000
3️⃣ Frontend Setup
cd frontend
npm install
npm run dev

Frontend runs at:

http://localhost:5173
🌐 Deployment Notes

Frontend can be deployed to:

Netlify

Vercel

Backend can be deployed to:

Render

Railway

Fly.io

Required Environment Variables:

DATABASE_URL

GROQ_API_KEY

VITE_API_BASE_URL (frontend)

ALLOWED_ORIGINS (backend for CORS)

🔐 Security Practices

.env excluded via .gitignore

Secrets removed from Git history

Environment variables used for configuration

No credentials stored in repository

🧩 Key Design Decisions

Hybrid OCR + LLM approach for flexibility

Validation before database persistence

Fallback extraction for reliability

Layered backend structure (routes → services → repositories)

SQL-based aggregation for KPI performance

🎯 What This Project Demonstrates

Full-stack development

AI integration in real workflows

Structured data extraction from unstructured documents

Data validation & integrity

Analytics generation

Production-aware architecture

📹 Demo

(Insert video link here)

📌 Future Improvements

Confidence scoring refinement

Manual correction workflow

Chart-based visualization (Recharts)

Role-based authentication

Bulk export reporting

👤 Author

Manohar Rangapuram
Backend & Full-Stack Developer
