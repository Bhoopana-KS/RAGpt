# RAGpt — React + FastAPI RAG Chatbot

A local document chatbot using React, FastAPI, ChromaDB, Sentence Transformers, and Ollama.
Theme: cream, brown, and gold. Supports PDF, TXT, and DOCX uploads.

## Requirements
- Python 3.10+ (3.11/3.12 recommended)
- Node.js LTS and npm
- Ollama installed and running
- Your existing ChromaDB database can be copied into `backend/chroma_db` if you want to reuse it.

## 1. Open the folder in VS Code
Extract this ZIP. In VS Code, open the `insightflow_react` folder.

## 2. Set up the Python backend
Open a VS Code terminal (Terminal → New Terminal), then run:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks activation, use Command Prompt terminal and run:
```bat
.venv\Scripts\activate.bat
```

## 3. Make sure Ollama is ready
Install Ollama from https://ollama.com/download if needed. In a separate terminal, run:
```bash
ollama pull llama3.2:1b
ollama serve
```
If Ollama is already running, `ollama serve` may say the port is in use; that's okay. Ensure the model is present with `ollama list`.

## 4. Start FastAPI
From the `backend` directory with the virtual environment activated:
```bash
uvicorn main:app --reload --port 8000
```
Keep this terminal open. Test `http://127.0.0.1:8000/health` in a browser; it should show `{"status":"ok",...}`.

## 5. Start React
Open a second VS Code terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open the Local URL printed by Vite, usually http://localhost:5173.

## 6. Upload and chat
- Click the + button next to the composer to select PDF, TXT, or DOCX files.
- Click Send / press Enter to send the message.
- Uploaded documents are chunked and indexed into `backend/chroma_db`.
- Processed files appear in the left sidebar. Click the X to remove a file and its chunks.

## Reusing the existing ChromaDB
Your Streamlit app used `BASE_DIR / "chroma_db"`. To reuse that database, copy the complete `chroma_db` folder from the directory containing your old `app.py` into `backend/chroma_db` (replace the new empty folder if it exists). Stop the old app first. Do not copy while the database is in use.

If you prefer a fresh database, leave `backend/chroma_db` as it is. Upload your documents again in the new UI.

## Important
- `frontend/public/logo.png` contains the RAGpt logo in a cream-and-brown palette matching the UI.
- This is a local development app, not a public production deployment. Do not expose the backend to the internet without adding authentication and upload limits.
- The code supports text-based PDFs. Scanned/image-only PDFs may need OCR, which is not included.
