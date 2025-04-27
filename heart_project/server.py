import pandas as pd
import numpy as np
import json
from flask import Flask, jsonify, send_from_directory
import os

app = Flask(__name__, static_folder='.')

# Load the ECG dataset
def load_ecg_data(file_path='ecg.csv'):
    try:
        # Read CSV file
        df = pd.read_csv(file_path)
        
        # Process data to JSON format
        ecg_data = []
        
        for index, row in df.iterrows():
            # Extract ECG readings (first 140 columns) and label
            patient_data = {}
            
            # Add ECG data points
            for i in range(140):
                col_name = str(i) if str(i) in df.columns else i
                # Ensure we're getting a numeric value and handling potential non-numeric data
                try:
                    patient_data[str(i)] = float(row[col_name])
                except (ValueError, KeyError):
                    # If conversion fails, use a placeholder value
                    patient_data[str(i)] = 0.0
            
            # Add label
            patient_data['label'] = int(row['label']) if 'label' in row else 0
            
            # Check for unrealistic values and normalize if needed
            values = [patient_data[str(i)] for i in range(140)]
            max_val = max(values)
            min_val = min(values)
            
            # If values are extremely high or unrealistic
            if max_val > 10 or min_val < -10:
                # Simple normalization to the 0-1 range for display purposes
                normalized_values = [(val - min_val) / (max_val - min_val) for val in values]
                for i in range(140):
                    patient_data[str(i)] = normalized_values[i]
            
            ecg_data.append(patient_data)
            
            # Limit to 50 patients for better performance
            if index >= 49:
                break
                
        return ecg_data
    except Exception as e:
        print(f"Error loading ECG data: {e}")
        # Return sample data if file can't be loaded
        return generate_sample_data()

def generate_sample_data():
    """Generate anatomically accurate ECG sample data representing real cardiac cycles"""
    sample_data = []
    
    # Generate 5 normal and 5 abnormal sample patients
    for i in range(10):
        patient_data = {}
        
        # ECG parameters
        heart_rate = 75 + np.random.randint(-15, 15)  # BPM
        sample_rate = 140  # Our sample length
        is_normal = i < 5  # First 5 are normal
        
        # Time vector (in seconds)
        cycle_duration = 60 / heart_rate  # seconds per heartbeat
        t = np.linspace(0, cycle_duration * 1.5, sample_rate)  # Capture 1.5 cycles
        
        # Initialize signal
        signal = np.zeros(sample_rate)
        
        if is_normal:
            # ---- Normal ECG Pattern ----
            
            # P wave (atrial depolarization)
            # Typically 80-100ms in duration, occurs ~200ms before QRS
            p_center = cycle_duration * 0.2
            p_width = 0.08  # 80ms
            p_amp = 0.15
            p_wave = p_amp * np.exp(-(t - p_center)**2 / (2 * (p_width/5)**2))
            
            # QRS complex (ventricular depolarization)
            # Typically 80-120ms in duration
            qrs_center = cycle_duration * 0.4
            q_width = 0.02  # 20ms
            q_amp = -0.1
            r_width = 0.02  # 20ms
            r_amp = 1.0
            s_width = 0.02  # 20ms
            s_amp = -0.3
            
            # Q wave
            q_wave = q_amp * np.exp(-(t - (qrs_center - 0.04))**2 / (2 * (q_width/3)**2))
            
            # R wave
            r_wave = r_amp * np.exp(-(t - qrs_center)**2 / (2 * (r_width/3)**2))
            
            # S wave
            s_wave = s_amp * np.exp(-(t - (qrs_center + 0.04))**2 / (2 * (s_width/3)**2))
            
            # ST segment
            st_duration = 0.1  # 100ms
            st_level = 0.05
            st_segment = np.full((int(st_duration * sample_rate / cycle_duration),), st_level)
            
            # T wave (ventricular repolarization)
            # Typically 160ms in duration, occurs ~300ms after QRS
            t_center = qrs_center + 0.24
            t_width = 0.16  # 160ms
            t_amp = 0.3
            t_wave = t_amp * np.exp(-(t - t_center)**2 / (2 * (t_width/5)**2))
            
            # Combine all components
            for j in range(sample_rate):
                signal[j] = p_wave[j] + q_wave[j] + r_wave[j] + s_wave[j] + t_wave[j]
                
            # Add some baseline wander and noise
            baseline = 0.05 * np.sin(2 * np.pi * 0.3 * t)
            noise = np.random.normal(0, 0.01, sample_rate)
            signal = signal + baseline + noise
            
        else:
            # ---- Abnormal ECG Patterns ----
            # For this example, we'll create various abnormalities:
            
            abnormality = i % 5  # Different types of abnormalities
            
            if abnormality == 0:
                # Atrial fibrillation - irregular rhythm, absence of P waves
                for j in range(sample_rate):
                    t_local = t[j]
                    
                    # Irregular R peaks
                    irregular_factor = 0.2 * np.sin(10 * t_local)
                    r_time = cycle_duration * (0.4 + irregular_factor)
                    r_peak = 1.0 * np.exp(-(t_local - r_time)**2 / (2 * (0.02)**2))
                    
                    # Small, irregular fluctuations instead of P waves
                    fibrillation = 0.1 * np.sin(50 * t_local) + 0.1 * np.sin(30 * t_local + np.pi/4)
                    
                    # T wave
                    t_peak = 0.3 * np.exp(-(t_local - (r_time + 0.16))**2 / (2 * (0.16/5)**2))
                    
                    signal[j] = r_peak + fibrillation + t_peak
                
            elif abnormality == 1:
                # ST segment elevation (possible myocardial infarction)
                # Normal P wave
                p_center = cycle_duration * 0.2
                p_width = 0.08
                p_amp = 0.15
                p_wave = p_amp * np.exp(-(t - p_center)**2 / (2 * (p_width/5)**2))
                
                # Normal QRS
                qrs_center = cycle_duration * 0.4
                q_width = 0.02
                q_amp = -0.1
                r_width = 0.02
                r_amp = 1.0
                s_width = 0.02
                s_amp = -0.2
                
                q_wave = q_amp * np.exp(-(t - (qrs_center - 0.04))**2 / (2 * (q_width/3)**2))
                r_wave = r_amp * np.exp(-(t - qrs_center)**2 / (2 * (r_width/3)**2))
                s_wave = s_amp * np.exp(-(t - (qrs_center + 0.04))**2 / (2 * (s_width/3)**2))
                
                # Elevated ST segment
                st_elevation = 0.3
                st_wave = st_elevation * np.ones_like(t)
                st_wave[t < qrs_center + 0.06] = 0
                st_wave[t > qrs_center + 0.25] = 0
                
                # T wave
                t_center = qrs_center + 0.3
                t_width = 0.18
                t_amp = 0.4
                t_wave = t_amp * np.exp(-(t - t_center)**2 / (2 * (t_width/5)**2))
                
                # Combine
                signal = p_wave + q_wave + r_wave + s_wave + st_wave + t_wave
                
            elif abnormality == 2:
                # Ventricular tachycardia - wide QRS complexes in rapid succession
                heart_rate = 150  # Faster heart rate
                cycle_duration = 60 / heart_rate
                
                for cycle in range(3):
                    cycle_start = cycle * cycle_duration / 2
                    
                    # Wide QRS complex
                    qrs_center = cycle_start + 0.15
                    qrs_width = 0.16  # Wider than normal
                    qrs_amp = 1.2
                    
                    # Create wide, bizarre QRS complex
                    for j in range(sample_rate):
                        if t[j] > cycle_start and t[j] < cycle_start + cycle_duration/2:
                            # Bizarre QRS morphology
                            distance = abs(t[j] - qrs_center)
                            if distance < qrs_width/2:
                                # Different shapes for different cycles
                                if cycle % 2 == 0:
                                    signal[j] += qrs_amp * np.sin(np.pi * distance / qrs_width)
                                else:
                                    signal[j] += qrs_amp * np.cos(np.pi * distance / qrs_width)
                            
                # Add noise
                signal += np.random.normal(0, 0.05, sample_rate)
                
            elif abnormality == 3:
                # Complete heart block - P waves and QRS complexes independent
                
                # Regular P waves at normal rate
                p_rate = 75  # atrial rate
                p_cycle = 60 / p_rate
                for i in range(3):
                    p_center = i * p_cycle/2 + 0.1
                    p_wave = 0.2 * np.exp(-(t - p_center)**2 / (2 * (0.08/5)**2))
                    signal += p_wave
                
                # Slower, independent QRS complexes
                v_rate = 40  # ventricular rate
                v_cycle = 60 / v_rate
                for i in range(2):
                    # QRS complex
                    qrs_center = i * v_cycle/2 + 0.2
                    q_wave = -0.1 * np.exp(-(t - (qrs_center - 0.04))**2 / (2 * (0.02/3)**2))
                    r_wave = 1.0 * np.exp(-(t - qrs_center)**2 / (2 * (0.02/3)**2))
                    s_wave = -0.3 * np.exp(-(t - (qrs_center + 0.04))**2 / (2 * (0.02/3)**2))
                    
                    # T wave
                    t_center = qrs_center + 0.24
                    t_wave = 0.3 * np.exp(-(t - t_center)**2 / (2 * (0.16/5)**2))
                    
                    signal += q_wave + r_wave + s_wave + t_wave
                
            elif abnormality == 4:
                # Long QT syndrome
                # Normal P wave
                p_center = cycle_duration * 0.2
                p_wave = 0.15 * np.exp(-(t - p_center)**2 / (2 * (0.08/5)**2))
                
                # Normal QRS
                qrs_center = cycle_duration * 0.4
                q_wave = -0.1 * np.exp(-(t - (qrs_center - 0.04))**2 / (2 * (0.02/3)**2))
                r_wave = 1.0 * np.exp(-(t - qrs_center)**2 / (2 * (0.02/3)**2))
                s_wave = -0.3 * np.exp(-(t - (qrs_center + 0.04))**2 / (2 * (0.02/3)**2))
                
                # Prolonged ST segment
                st_duration = 0.25  # Much longer than normal
                st_segment = 0.05 * np.ones_like(t)
                st_segment[t < qrs_center + 0.06] = 0
                st_segment[t > qrs_center + st_duration] = 0
                
                # Broad, sometimes bifid T wave
                t_center = qrs_center + st_duration + 0.1
                t_width = 0.2  # Wider than normal
                t_wave1 = 0.15 * np.exp(-(t - (t_center - 0.05))**2 / (2 * (t_width/8)**2))
                t_wave2 = 0.2 * np.exp(-(t - t_center)**2 / (2 * (t_width/8)**2))
                t_wave = t_wave1 + t_wave2  # Bifid T wave
                
                # Combine
                signal = p_wave + q_wave + r_wave + s_wave + st_segment + t_wave
            
            # Add noise to all abnormal patterns
            signal += np.random.normal(0, 0.03, sample_rate)
        
        # Ensure signal is properly scaled to the 0-1 range
        signal = signal - np.min(signal)
        if np.max(signal) > 0:
            signal = signal / np.max(signal)
        
        # Convert to dictionary
        for j in range(sample_rate):
            patient_data[str(j)] = float(signal[j])
        
        # Add label
        patient_data['label'] = 0 if is_normal else 1
        
        sample_data.append(patient_data)
    
    return sample_data

# Route to serve the static HTML and JS files
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

# API endpoint to get ECG data
@app.route('/get_ecg_data')
def get_ecg_data():
    ecg_data = load_ecg_data()
    return jsonify(ecg_data)

if __name__ == '__main__':
    print("Starting Cardiac Cycle Visualization server at http://localhost:5000")
    # Check if the ECG dataset exists
    if not os.path.exists('ecg.csv'):
        print("Warning: ecg.csv not found. Using anatomically accurate sample data instead.")
        print("Place the ecg.csv file in the same directory as this script if you want to use real data.")
    
    app.run(debug=True, port=5000)