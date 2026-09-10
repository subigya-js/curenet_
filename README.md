# CureNet 🏥

CureNet is a comprehensive, AI-powered medical platform designed to bridge the gap between advanced medical research tools and accessible patient care. It provides an intuitive interface for both clinicians and patients, offering features ranging from AI-assisted diagnostic imaging (like Lung CT scans) to virtual appointments, chatbots, and electronic health records.

## 🏗️ Architecture & Structure

The repository is organized into three completely independent services, allowing for clean separation of concerns and scalable development:

```
curenet_/
├── frontend/     # React.js application (User Interface)
├── api/          # Node.js / Express backend (Database & Business Logic)
└── ml_services/  # Python / FastAPI backend (AI & Machine Learning Inference)
```

---

## 1️⃣ Frontend (React App)
The frontend is a robust Single Page Application built with **React.js**. It features a modern, dark-themed, glassmorphic UI designed to look highly professional for clinicians while remaining accessible to regular users.

- **Port**: `http://localhost:3000`
- **Key Tech**: React Router, Axios, Bootstrap, Custom Vanilla CSS
- **Features**:
  - **Dual Dashboards**: Separate views for Patients and Doctors/Admins.
  - **Laboratory / Diagnostics**: Upload medical scans (like Lung CTs) for instant AI screening. Results are displayed with plain English explanations, numbered next steps, Grad-CAM metrics, and clinical summaries.
  - **Appointments**: Schedule and view text or virtual appointments.
  - **AI Chatbot**: Built-in chatbot for answering quick medical queries.

### Setup & Run (Frontend)
```bash
cd frontend
npm install
npm run start
```

---

## 2️⃣ API (Node.js/Express)
The core backend handles all the standard application logic, database operations, user authentication, and serves as a bridge for the chatbot.

- **Port**: `http://localhost:8801`
- **Key Tech**: Node.js, Express, MySQL (mysql2), Express-Session, Multer (for file uploads)
- **Database**: Connects to a MySQL database named `curenet` on port `3306`.
- **Features**:
  - Secure authentication and session management for Patients, Doctors, and Admins.
  - CRUD operations for medical history, appointments, and hospital tables.
  - Intermediary routing (routes queries to the Python ML services when AI is needed).

### Setup & Run (API)
Ensure you have a local MySQL instance running with a database named `curenet`. Configure your `.env` file based on `.env.example`.
```bash
cd api
npm install
npm run start    # Starts with nodemon for hot-reloading
```

---

## 3️⃣ ML Services (Python/FastAPI)
The machine learning microservice is dedicated entirely to heavy computational tasks, deep learning inference, and NLP processing. 

- **Port**: `http://127.0.0.1:8000`
- **Key Tech**: Python 3.11+, FastAPI, Uvicorn, TensorFlow/Keras, OpenCV, Numpy
- **Features**:
  - **Lung Cancer CT Screening**: Uses a retrained deep learning model to classify CT slices into Normal, Benign, or Malignant.
  - **Grad-CAM Attention Maps**: Generates visual heatmaps (attention overlays) explaining exactly which parts of a scan influenced the AI's decision.
  - **Medical Chatbot Backend**: Processes NLP queries (e.g., via `recommend.py`).
  - **Training Pipelines**: Includes scripts like `train_lung.py` and `download_lung_dataset.py` to fetch data from Kaggle and train/retrain the models locally.

### Setup & Run (ML Services)
It is highly recommended to use a virtual environment to avoid dependency conflicts.
```bash
cd ml_services
python3.11 -m venv .venv
source .venv/bin/activate       # On Mac/Linux
# .venv\Scripts\activate        # On Windows

# Install dependencies
pip install -r requirements.txt
# (Optional) Install training dependencies if you want to train models
pip install -r requirements-train.txt

# Start the inference server
uvicorn app:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🚀 Quick Start (Running Everything Locally)

To get the entire stack running at once, you will need **three separate terminal windows**.

**Terminal 1 (Database & API)**
```bash
cd api
npm run start
```

**Terminal 2 (AI/ML Backend)**
```bash
cd ml_services
source .venv/bin/activate
uvicorn app:app --host 127.0.0.1 --port 8000
```

**Terminal 3 (User Interface)**
```bash
cd frontend
npm run start
```

## 📝 Note on Diagnostics (Disclaimer)
All machine learning features in this application (such as the Lung CT analysis) are strictly for **research and demonstration purposes**. The AI provides pattern-matching scores based on its training data and generates Grad-CAM overlays to visualize its attention. **It does not provide medical diagnoses.** Always consult a qualified healthcare professional.
