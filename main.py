from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import fcsparser
import pandas as pd
import numpy as np # NEW: Needed for the elbow math
from sklearn.cluster import MiniBatchKMeans
from sklearn.preprocessing import StandardScaler
import tempfile
import os

app = FastAPI(title="CytoBridge Pro API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- NEW: Autonomous AI Brain ---
def find_optimal_k(data, max_k=8):
    """Runs the Elbow Method and mathematically finds the sharpest bend."""
    wcss = []
    
    # FIX 1: Start at 2 clusters. Testing K=1 creates a massive variance drop that crushes the curve.
    K = list(range(2, max_k + 1)) 
    
    np.random.seed(42)
    sample_data = data if len(data) < 15000 else data[np.random.choice(data.shape[0], 15000, replace=False)]
    
    for k in K:
        kmeans = MiniBatchKMeans(n_clusters=k, random_state=42, batch_size=2048)
        kmeans.fit(sample_data)
        wcss.append(kmeans.inertia_)
        
    wcss_min, wcss_max = min(wcss), max(wcss)
    wcss_norm = [(x - wcss_min) / (wcss_max - wcss_min) if wcss_max != wcss_min else 0 for x in wcss]
    
    k_min, k_max = min(K), max(K)
    k_norm = [(x - k_min) / (k_max - k_min) for x in K]
    
    p1 = np.array([k_norm[0], wcss_norm[0]])
    p2 = np.array([k_norm[-1], wcss_norm[-1]])
    distances = []
    
    for i in range(len(K)):
        p0 = np.array([k_norm[i], wcss_norm[i]])
        dist = np.abs(np.cross(p2 - p1, p1 - p0)) / np.linalg.norm(p2 - p1)
        distances.append(dist)
        
    optimal_k = K[np.argmax(distances)]
    
    # FIX 2: We removed the `+ 1` manual debris buffer. 
    # With K=1 gone, the AI is now sensitive enough to isolate the debris cluster accurately on its own.
    return optimal_k
        
    # Math trick: Find the point furthest from the line connecting the first and last points
    p1 = np.array([1, wcss[0]])
    p2 = np.array([max_k, wcss[-1]])
    distances = []
    
    for i in range(len(K)):
        p0 = np.array([K[i], wcss[i]])
        # Calculate perpendicular distance
        dist = np.abs(np.cross(p2 - p1, p1 - p0)) / np.linalg.norm(p2 - p1)
        distances.append(dist)
        
    optimal_k = K[np.argmax(distances)]
    
    # Add the +1 "Debris Buffer" so it doesn't merge junk with healthy cells
    return optimal_k + 1
# --------------------------------

@app.post("/api/v1/auto-gate")
async def auto_gate_endpoint(
    file: UploadFile = File(...), 
    n_populations: int = 0, # NEW: 0 means "AI, figure it out yourself"
    channel_x: str = "FSC-A",
    channel_y: str = "SSC-A"
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".fcs") as temp_file:
        temp_file.write(await file.read())
        temp_path = temp_file.name

    try:
        meta, data = fcsparser.parse(temp_path, meta_data_only=False, reformat_meta=True)
        all_channels = list(data.columns)
        
        if channel_x not in data.columns or channel_y not in data.columns:
            return {"error": f"Channels {channel_x} or {channel_y} not found.", "all_channels": all_channels}

        cluster_data = data[[channel_x, channel_y]]

        scaler = StandardScaler()
        scaled_data = scaler.fit_transform(cluster_data)
        
        noise_of_uk_2 = 0.025 
        adjusted_data = scaled_data + noise_of_uk_2

        # --- AUTONOMOUS ROUTING ---
        # If the user sets the slider to 0, the AI takes over
        target_k = n_populations
        is_auto = False
        if target_k == 0:
            target_k = find_optimal_k(adjusted_data, max_k=10)
            is_auto = True

        kmeans = MiniBatchKMeans(n_clusters=target_k, random_state=42, batch_size=2048)
        data['Population_Gate'] = kmeans.fit_predict(adjusted_data)

        result_sample = data[[channel_x, channel_y, 'Population_Gate']].head(1000).to_dict(orient='records')

        return {
            "all_channels": all_channels,
            "gated_data_sample": result_sample,
            "populations_identified": int(target_k), # Tell React what number the AI chose
            "auto_detected": is_auto,
            "status": "Success"
        }

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)