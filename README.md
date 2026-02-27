# CytoBridge Pro 🧬
**Autonomous Machine Learning Middleware for Flow Cytometry Data Pipelines**

## Overview
CytoBridge Pro is a high-performance, full-stack application designed to automate the flow cytometry gating process. By replacing subjective, manual polygon gating with objective, unsupervised machine learning (Mini-Batch K-Means), this tool translates proprietary `.fcs` instrument files into standardized, ML-ready CSV datasets in seconds.

## Key Features
* **Universal .fcs Ingestion:** Parses proprietary flow cytometry data from any major instrument.
* **Autonomous AI Auto-Detect:** Utilizes a custom, scale-invariant Elbow Method algorithm to dynamically calculate the optimal number of biological populations in highly heterogeneous samples (e.g., solid tumors vs. whole blood).
* **Multi-Dimensional Clustering:** Employs `scikit-learn` Mini-Batch K-Means with variance standardization to objectively cluster cells based on physical scatter (FSC/SSC) or fluorescent biomarkers.
* **Real-Time Visualization:** WebGL-accelerated React dashboard capable of rendering complex cell populations instantly.
* **ML-Ready Export:** Converts visual clusters into hardcoded, machine-readable datasets (CSV) for downstream computational biology pipelines.

## Tech Stack
* **Backend:** Python, FastAPI, scikit-learn, pandas, fcsparser
* **Frontend:** React, Vite, Plotly.js

## Local Installation
1. Clone the repository:
   `git clone https://github.com/Ankit-2048/cytobridge-pro.git`
2. Start the Python API (Backend):
   `pip install fastapi uvicorn python-multipart fcsparser pandas scikit-learn`
   `uvicorn main:app --reload`
3. Start the React UI (Frontend):
   `npm install`
   `npm run dev`

---
**Author:** Ankit Mitra