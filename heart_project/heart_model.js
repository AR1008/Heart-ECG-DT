// Update heart rate based on ECG data
function updateHeartRate(index) {
    if (index > 0) {
        // R-peak detection for BPM calculation
        const prevValue = parseFloat(currentPatientData[(index - 1 + 140) % 140]);
        const currentValue = parseFloat(currentPatientData[index]);
        
        // If we detect a significant upward slope in the ECG, consider it a potential R peak
        if (currentValue - prevValue > 0.15 && currentValue > 0.5) {
            const now = Date.now();
            const timeSinceLastBeat = now - lastBeatTime;
            
            // Ensure reasonable time between beats (avoid double-counting)
            if (timeSinceLastBeat > 200) {
                lastBeatTime = now;
                
                // Calculate BPM
                if (timeSinceLastBeat > 0) { // Prevent division by zero
                    // Adjust for playback speed
                    const rawBPM = (60000 / timeSinceLastBeat);
                    const adjustedBPM = rawBPM * playbackSpeed;
                    const finalBPM = Math.min(200, Math.max(40, Math.round(adjustedBPM)));
                    
                    // Apply smoothing
                    if (bpmValue === 0) {
                        bpmValue = finalBPM;
                    } else {
                        bpmValue = Math.round(bpmValue * 0.8 + finalBPM * 0.2);
                    }
                    
                    // Update BPM display
                    document.getElementById('bpmText').textContent = bpmValue;
                }
            }
        }
        
        // Fallback if no beats detected for 3 seconds
        const now = Date.now();
        if (now - lastBeatTime > 3000) {
            // Derive BPM from the sample data
            const baseHeartRate = currentPatientData.hasOwnProperty('heartRate') ? 
                parseInt(currentPatientData.heartRate) : 75;
                
            // Apply playback speed
            bpmValue = Math.round(baseHeartRate * playbackSpeed);
            document.getElementById('bpmText').textContent = bpmValue;
            lastBeatTime = now;
        }
    }
}

// Update ECG graph with a single clean wave like in the reference image
function updateSingleEcgWave(index, value) {
    if (!ecgCtx) return;
    
    const width = ecgCanvas.width;
    const height = ecgCanvas.height;
    
    // Clear canvas completely to show only one clean wave
    ecgCtx.fillStyle = 'rgb(0, 0, 0)';
    ecgCtx.fillRect(0, 0, width, height);
    
    // Draw professional ECG grid like in the reference image
    drawEcgGrid(width, height);
    
    // Collect data points for a single clean ECG cycle
    const positions = [];
    for (let i = 0; i < 140; i++) {
        const idx = (index + i) % 140;
        let val = parseFloat(currentPatientData[idx]);
        
        if (normalizeData) {
            const ecgValues = Object.keys(currentPatientData)
                .filter(key => !isNaN(parseInt(key)) && parseInt(key) < 140)
                .map(key => parseFloat(currentPatientData[key]));
                
            const maxVal = Math.max(...ecgValues);
            const minVal = Math.min(...ecgValues);
            
            val = (val - minVal) / (maxVal - minVal);
        }
        
        // Position in graph
        const x = (i / 140) * width;
        // Invert and scale for better visibility
        const y = height - (val * (height * 0.6) + (height * 0.2));
        
        positions.push({x, y, idx});
    }
    
    // Draw ECG components with correct colors matching the reference image
    drawColoredEcgSegments(positions);
}

// Draw the ECG grid like in the reference image
function drawEcgGrid(width, height) {
    // Major grid lines
    ecgCtx.strokeStyle = 'rgba(60, 60, 60, 0.8)';
    ecgCtx.lineWidth = 0.5;
    ecgCtx.beginPath();
    
    // Draw vertical major grid lines
    for (let i = 0; i < width; i += 50) {
        ecgCtx.moveTo(i, 0);
        ecgCtx.lineTo(i, height);
    }
    
    // Draw horizontal major grid lines
    for (let i = 0; i < height; i += 50) {
        ecgCtx.moveTo(0, i);
        ecgCtx.lineTo(width, i);
    }
    ecgCtx.stroke();
    
    // Minor grid lines
    ecgCtx.strokeStyle = 'rgba(50, 50, 50, 0.5)';
    ecgCtx.lineWidth = 0.25;
    ecgCtx.beginPath();
    
    // Draw vertical minor grid lines
    for (let i = 0; i < width; i += 10) {
        ecgCtx.moveTo(i, 0);
        ecgCtx.lineTo(i, height);
    }
    
    // Draw horizontal minor grid lines
    for (let i = 0; i < height; i += 10) {
        ecgCtx.moveTo(0, i);
        ecgCtx.lineTo(width, i);
    }
    ecgCtx.stroke();
}

// Draw the ECG waves in different colors like in the reference image
function drawColoredEcgSegments(positions) {
    // First draw the complete ECG line in white (background trace)
    ecgCtx.strokeStyle = 'rgba(200, 200, 200, 0.8)';
    ecgCtx.lineWidth = 1.5;
    ecgCtx.beginPath();
    
    for (let i = 0; i < positions.length; i++) {
        const {x, y} = positions[i];
        if (i === 0) {
            ecgCtx.moveTo(x, y);
        } else {
            ecgCtx.lineTo(x, y);
        }
    }
    
    ecgCtx.stroke();
    
    // Find P, QRS, and T wave segments
    let pPeakPos = null, qPos = null, rPos = null, sPos = null, tPeakPos = null;
    
    // Drawing P wave in blue
    if (pWaveStart !== -1 && pWaveEnd !== -1) {
        // Find P peak for labeling
        let pPeakIdx = pWaveStart;
        let pHighestY = Infinity;
        
        for (let i = pWaveStart; i <= pWaveEnd; i++) {
            const idx = i % 140;
            const pos = positions.find(p => p.idx % 140 === idx);
            if (pos && pos.y < pHighestY) {
                pHighestY = pos.y;
                pPeakIdx = i;
            }
        }
        
        pPeakPos = positions.find(p => p.idx % 140 === pPeakIdx % 140);
        
        // Draw P wave segment
        ecgCtx.strokeStyle = 'rgb(0, 120, 255)'; // Blue
        ecgCtx.lineWidth = 2;
        ecgCtx.beginPath();
        
        let hasStarted = false;
        for (let i = 0; i < positions.length; i++) {
            const {x, y, idx} = positions[i];
            if (isInRange(idx, pWaveStart, pWaveEnd)) {
                if (!hasStarted) {
                    ecgCtx.moveTo(x, y);
                    hasStarted = true;
                } else {
                    ecgCtx.lineTo(x, y);
                }
            }
        }
        
        ecgCtx.stroke();
    }
    
    // Drawing T wave in green
    if (tWaveStart !== -1 && tWaveEnd !== -1) {
        // Find T peak for labeling
        let tPeakIdx = tWaveStart;
        let tHighestY = Infinity;
        
        for (let i = tWaveStart; i <= tWaveEnd; i++) {
            const idx = i % 140;
            const pos = positions.find(p => p.idx % 140 === idx);
            if (pos && pos.y < tHighestY) {
                tHighestY = pos.y;
                tPeakIdx = i;
            }
        }
        
        tPeakPos = positions.find(p => p.idx % 140 === tPeakIdx % 140);
        
        // Draw T wave segment
        ecgCtx.strokeStyle = 'rgb(0, 220, 0)'; // Green
        ecgCtx.lineWidth = 2;
        ecgCtx.beginPath();
        
        let hasStarted = false;
        for (let i = 0; i < positions.length; i++) {
            const {x, y, idx} = positions[i];
            if (isInRange(idx, tWaveStart, tWaveEnd)) {
                if (!hasStarted) {
                    ecgCtx.moveTo(x, y);
                    hasStarted = true;
                } else {
                    ecgCtx.lineTo(x, y);
                }
            }
        }
        
        ecgCtx.stroke();
    }
    
    // Drawing QRS complex in red
    if (qrsStart !== -1 && qrsEnd !== -1) {
        // Find QRS points
        qPos = positions.find(p => p.idx % 140 === qrsStart % 140);
        
        // Find R peak
        let rPeakIdx = qrsStart;
        let highestY = Infinity;
        
        for (let i = qrsStart; i <= qrsEnd; i++) {
            const idx = i % 140;
            const pos = positions.find(p => p.idx % 140 === idx);
            if (pos && pos.y < highestY) {
                highestY = pos.y;
                rPeakIdx = i;
            }
        }
        
        rPos = positions.find(p => p.idx % 140 === rPeakIdx % 140);
        
        // Find S point
        let sIdx = rPeakIdx;
        let lowestY = -Infinity;
        
        for (let i = rPeakIdx + 1; i <= qrsEnd; i++) {
            const idx = i % 140;
            const pos = positions.find(p => p.idx % 140 === idx);
            if (pos && pos.y > lowestY) {
                lowestY = pos.y;
                sIdx = i;
            }
        }
        
        sPos = positions.find(p => p.idx % 140 === sIdx % 140);
        
        // Draw QRS complex segment
        ecgCtx.strokeStyle = 'rgb(255, 50, 50)'; // Red
        ecgCtx.lineWidth = 2;
        ecgCtx.beginPath();
        
        let hasStarted = false;
        for (let i = 0; i < positions.length; i++) {
            const {x, y, idx} = positions[i];
            if (isInRange(idx, qrsStart, qrsEnd)) {
                if (!hasStarted) {
                    ecgCtx.moveTo(x, y);
                    hasStarted = true;
                } else {
                    ecgCtx.lineTo(x, y);
                }
            }
        }
        
        ecgCtx.stroke();
    }
    
    // Add labels exactly like in the reference image
    addEcgLabels(pPeakPos, qPos, rPos, sPos, tPeakPos);
}

// Add labels to ECG segments like in the reference image
function addEcgLabels(pPos, qPos, rPos, sPos, tPos) {
    // Set label style
    ecgCtx.font = 'bold 16px Arial';
    
    // Label P wave
    if (pPos) {
        ecgCtx.fillStyle = 'rgb(0, 120, 255)'; // Blue
        ecgCtx.fillText('P', pPos.x, pPos.y - 10);
    }
    
    // Label QRS points
    if (qPos) {
        ecgCtx.fillStyle = 'rgb(255, 50, 50)'; // Red
        ecgCtx.fillText('Q', qPos.x - 5, qPos.y + 20);
    }
    
    if (rPos) {
        ecgCtx.fillStyle = 'rgb(255, 50, 50)'; // Red
        ecgCtx.fillText('R', rPos.x - 5, rPos.y - 10);
    }
    
    if (sPos) {
        ecgCtx.fillStyle = 'rgb(255, 50, 50)'; // Red
        ecgCtx.fillText('S', sPos.x - 5, sPos.y + 20);
    }
    
    // Label T wave
    if (tPos) {
        ecgCtx.fillStyle = 'rgb(0, 220, 0)'; // Green
        ecgCtx.fillText('T', tPos.x - 5, tPos.y - 10);
    }
}

// Handle window resize
function onWindowResize() {
    // Get current ECG height
    const ecgHeight = parseInt(getComputedStyle(ecgCanvas).height, 10);
    
    // Update camera aspect ratio
    camera.aspect = window.innerWidth / (window.innerHeight - ecgHeight);
    camera.updateProjectionMatrix();
    
    // Update renderer size
    renderer.setSize(window.innerWidth, window.innerHeight - ecgHeight);
    
    // Update ECG canvas width
    ecgCanvas.width = window.innerWidth;
    
    // Render the scene
    render();
}

// Start animation
function startAnimation() {
    if (!isPlaying) {
        isPlaying = true;
        animate();
    }
}

// Stop animation
function stopAnimation() {
    isPlaying = false;
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Toggle normalization of ECG data
function toggleNormalize() {
    normalizeData = !normalizeData;
    const button = document.getElementById('normalizeButton');
    if (button) {
        button.textContent = normalizeData ? 'Disable Normalize' : 'Enable Normalize';
    }
}

// Adjust animation speed
function adjustSpeed() {
    const slider = document.getElementById('speedSlider');
    if (slider) {
        playbackSpeed = parseFloat(slider.value);
        const speedDisplay = document.getElementById('speedValue');
        if (speedDisplay) {
            speedDisplay.textContent = playbackSpeed.toFixed(2) + 'x';
        }
    }
}

// Change patient data
function changePatient() {
    const select = document.getElementById('patientSelect');
    if (!select) return;
    
    patientIndex = parseInt(select.value);
    currentPatientData = ecgData[patientIndex];
    currentEcgIndex = 0;
    
    // Reset ECG wave detection
    pWaveStart = -1;
    pWaveEnd = -1;
    qrsStart = -1;
    qrsEnd = -1;
    tWaveStart = -1;
    tWaveEnd = -1;
    ecgBuffer = [];
    
    // Update status text based on label
    const label = parseInt(currentPatientData['label']);
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = label === 0 ? 'Normal' : 'Abnormal';
        statusText.style.color = label === 0 ? '#4CAF50' : '#FF5252';
    }
}

// Setup patient selector dropdown
function setupPatientSelector() {
    const select = document.getElementById('patientSelect');
    if (!select) {
        console.error("Patient selector element not found!");
        return;
    }
    
    select.innerHTML = ''; // Clear any existing options
    
    for (let i = 0; i < ecgData.length; i++) {
        const option = document.createElement('option');
        option.value = i;
        const label = parseInt(ecgData[i]['label']);
        option.textContent = `Patient ${i+1} (${label === 0 ? 'Normal' : 'Abnormal'})`;
        select.appendChild(option);
    }
}

function ensureBpmDisplay() {
    const bpmText = document.getElementById('bpmText');
    if (!bpmText) return;
    
    // If BPM is still not showing after 2 seconds, force a display
    setTimeout(() => {
        if (bpmText.textContent === "--") {
            // Set a reasonable default BPM based on the patient data
            let defaultBpm = 75;
            
            // Check if this is abnormal data
            if (currentPatientData && currentPatientData.hasOwnProperty('label')) {
                const isAbnormal = parseInt(currentPatientData.label) !== 0;
                // Adjust default BPM for abnormal patterns
                defaultBpm = isAbnormal ? 95 : 75;
            }
            
            // Apply playback speed adjustment
            bpmValue = Math.round(defaultBpm * playbackSpeed);
            bpmText.textContent = bpmValue;
        }
    }, 2000);
}

// Animate blood particles based on cardiac phase
function animateBloodParticles(phase) {
    if (!bloodParticles || !bloodParticles.length) return; // Guard clause for undefined or empty bloodParticles
    
    // Control which particles are active based on phase
    bloodParticles.forEach(particle => {
        const chamber = particle.userData.chamber;
        let isActive = true;
        
        switch(phase) {
            case "Atrial Systole":
                // During atrial systole, blood moves from atria to ventricles
                // Active: RA/LA inflow, RA-to-RV, LA-to-LV
                // Inactive: RV-to-PA, LV-to-AO
                if (chamber === 'rv-to-pa' || chamber === 'lv-to-ao') {
                    isActive = false;
                } else {
                    // Speed up atrial-ventricular flow
                    if (chamber === 'ra-to-rv' || chamber === 'la-to-lv') {
                        particle.userData.speed = 0.02 + Math.random() * 0.01;
                    }
                }
                break;
                
            case "Ventricular Systole":
                // During ventricular systole, blood moves from ventricles to arteries
                // Active: RV-to-PA, LV-to-AO
                // Inactive: RA-to-RV, LA-to-LV
                if (chamber === 'ra-to-rv' || chamber === 'la-to-lv') {
                    isActive = false;
                } else {
                    // Speed up ventricular-arterial flow
                    if (chamber === 'rv-to-pa' || chamber === 'lv-to-ao') {
                        particle.userData.speed = 0.02 + Math.random() * 0.01;
                    }
                }
                break;
                
            case "Ventricular Repolarization":
                // During repolarization, blood mainly flows into atria
                // Active: RA/LA inflow
                // Slower: RA-to-RV, LA-to-LV, RV-to-PA, LV-to-AO
                if (chamber === 'ra-inflow' || chamber === 'la-inflow') {
                    particle.userData.speed = 0.01 + Math.random() * 0.01;
                } else {
                    particle.userData.speed = 0.005 + Math.random() * 0.005;
                }
                break;
                
            case "Diastole":
                // During diastole, blood flows into atria and slowly into ventricles
                // Active: All inflows
                // Slower: outflows
                if (chamber === 'rv-to-pa' || chamber === 'lv-to-ao') {
                    particle.userData.speed = 0.003 + Math.random() * 0.003;
                } else {
                    particle.userData.speed = 0.008 + Math.random() * 0.005;
                }
                break;
        }
        
        // Update particle active state
        particle.userData.active = isActive;
        particle.visible = isActive;
        
        // Move active particles
        if (isActive) {
            // Update progress
            particle.userData.progress += particle.userData.speed;
            
            // Reset if complete
            if (particle.userData.progress > 1) {
                particle.userData.progress = 0;
                
                // Reset position to start with slight randomization
                particle.position.copy(particle.userData.start);
                particle.position.x += (Math.random() - 0.5) * 0.05;
                particle.position.y += (Math.random() - 0.5) * 0.05;
                particle.position.z += (Math.random() - 0.5) * 0.05;
            } else {
                // Move along path
                particle.position.lerpVectors(
                    particle.userData.start,
                    particle.userData.end,
                    particle.userData.progress
                );
                
                // Add small random motion for more natural flow
                if (Math.random() > 0.9) {
                    particle.position.x += (Math.random() - 0.5) * 0.01;
                    particle.position.y += (Math.random() - 0.5) * 0.01;
                    particle.position.z += (Math.random() - 0.5) * 0.01;
                }
            }
        }
    });
}

// Helper function to check if current index is within range
function isInRange(index, start, end) {
    return start !== -1 && end !== -1 && index >= start && index <= end;
}

// Update the heart phase based on ECG position
function updateHeartPhase(index) {
    // Default to diastole
    let phase = "Diastole";
    
    // P wave - atrial depolarization
    if (isInRange(index, pWaveStart, pWaveEnd)) {
        phase = "Atrial Systole";
    } 
    // QRS complex - ventricular depolarization
    else if (isInRange(index, qrsStart, qrsEnd)) {
        phase = "Ventricular Systole";
    }
    // T wave - ventricular repolarization
    else if (isInRange(index, tWaveStart, tWaveEnd)) {
        phase = "Ventricular Repolarization";
    }
    
    // Update the UI if the phase changed
    if (phase !== currentHeartPhase) {
        currentHeartPhase = phase;
        if (document.getElementById('phaseText')) {
            document.getElementById('phaseText').textContent = phase;
        }
        
        // Update phase description
        let phaseDescription = "";
        switch(phase) {
            case "Diastole":
                phaseDescription = "Heart relaxed, filling with blood";
                break;
            case "Atrial Systole":
                phaseDescription = "Atria contract, pushing blood to ventricles";
                break;
            case "Ventricular Systole":
                phaseDescription = "Ventricles contract, pumping blood to body/lungs";
                break;
            case "Ventricular Repolarization":
                phaseDescription = "Ventricles relaxing, preparing for filling";
                break;
        }
        if (document.getElementById('phaseDescription')) {
            document.getElementById('phaseDescription').textContent = phaseDescription;
        }
    }
}

// Animate the heart based on cardiac phase with valve movement
function animateHeartByCycle(phase, ecgValue) {
    // Animation intensity based on ECG value, amplified for more visible contractions
    const animationIntensity = Math.min(1, ecgValue * 2.0);
    
    // Animate different heart components based on cardiac phase
    switch (phase) {
        case "Atrial Systole":
            // P wave - atria contract, tricuspid and mitral valves open
            
            // Atria contraction with more pronounced squeezing
            const atriaContraction = 1.0 - (animationIntensity * 0.4);
            rightAtrium.scale.set(atriaContraction * 0.9, atriaContraction, atriaContraction * 1.1); // Slight elongation
            leftAtrium.scale.set(atriaContraction * 0.9, atriaContraction, atriaContraction * 1.1);
            rightAtrium.rotation.z = -Math.PI / 12 + animationIntensity * 0.1; // Slight twist
            leftAtrium.rotation.z = -Math.PI / 12 - animationIntensity * 0.1;
            
            // Blood decreases in atria and moves to ventricles
            bloodVolumes.rightAtrium.scale.set(atriaContraction * 0.6, atriaContraction * 0.6, atriaContraction * 0.6);
            bloodVolumes.leftAtrium.scale.set(atriaContraction * 0.6, atriaContraction * 0.6, atriaContraction * 0.6);
            
            // Blood increases in ventricles
            const ventriclesFilling = 1.0 + (animationIntensity * 0.25);
            bloodVolumes.rightVentricle.scale.set(ventriclesFilling * 1.1, ventriclesFilling, ventriclesFilling * 0.9);
            bloodVolumes.leftVentricle.scale.set(ventriclesFilling * 1.1, ventriclesFilling, ventriclesFilling * 0.9);
            
            // Valve animation - AV valves open wider
            const avValveOpenAngle = Math.PI * 0.5 * animationIntensity;
            valves.tricuspid.children.forEach(leaflet => {
                leaflet.rotation.z = avValveOpenAngle;
            });
            valves.mitral.children.forEach(leaflet => {
                leaflet.rotation.z = avValveOpenAngle;
            });
            
            // Semilunar valves closed
            valves.pulmonary.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            valves.aortic.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            
            // Atria color intensifies
            rightAtrium.material.color.setRGB(0.6 + animationIntensity * 0.3, 0.5 + animationIntensity * 0.1, 0.8);
            leftAtrium.material.color.setRGB(0.9, 0.4 + animationIntensity * 0.2, 0.4 + animationIntensity * 0.2);
            break;
            
        case "Ventricular Systole":
            // QRS complex - ventricles contract, AV valves close, semilunar valves open
            
            // Ventricular contraction with pronounced squeezing
            const ventriclesContraction = 1.0 - (animationIntensity * 0.5);
            rightVentricle.scale.set(ventriclesContraction * 1.1, ventriclesContraction * 0.9, ventriclesContraction);
            leftVentricle.scale.set(ventriclesContraction * 1.1, ventriclesContraction * 0.9, ventriclesContraction);
            rightVentricle.rotation.z = -Math.PI / 12 + animationIntensity * 0.15; // Twist for realism
            leftVentricle.rotation.z = -Math.PI / 12 - animationIntensity * 0.15;
            
            // Blood decreases in ventricles as it's ejected
            bloodVolumes.rightVentricle.scale.set(ventriclesContraction * 0.5, ventriclesContraction * 0.5, ventriclesContraction * 0.5);
            bloodVolumes.leftVentricle.scale.set(ventriclesContraction * 0.5, ventriclesContraction * 0.5, ventriclesContraction * 0.5);
            
            // Atria begin filling again
            const atriaFilling = 1.0 + (animationIntensity * 0.15);
            rightAtrium.scale.set(atriaFilling * 1.05, atriaFilling, atriaFilling * 0.95);
            leftAtrium.scale.set(atriaFilling * 1.05, atriaFilling, atriaFilling * 0.95);
            
            // Blood increases in atria
            bloodVolumes.rightAtrium.scale.set(atriaFilling * 0.8, atriaFilling * 0.8, atriaFilling * 0.8);
            bloodVolumes.leftAtrium.scale.set(atriaFilling * 0.8, atriaFilling * 0.8, atriaFilling * 0.8);
            
            // Valve animation - AV valves close, semilunar valves open wider
            valves.tricuspid.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            valves.mitral.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            
            const semilunarValveOpenAngle = Math.PI * 0.4 * animationIntensity;
            valves.pulmonary.children.forEach(leaflet => {
                leaflet.rotation.z = semilunarValveOpenAngle;
            });
            valves.aortic.children.forEach(leaflet => {
                leaflet.rotation.z = semilunarValveOpenAngle;
            });
            
            // Ventricles color intensifies
            rightVentricle.material.color.setRGB(0.5 + animationIntensity * 0.3, 0.4 + animationIntensity * 0.1, 0.7);
            leftVentricle.material.color.setRGB(0.8, 0.3 + animationIntensity * 0.2, 0.3 + animationIntensity * 0.2);
            
            // Vessels pulse with blood flow
            vessels.pulmonaryArtery.scale.set(1, 1 + animationIntensity * 0.25, 1);
            vessels.aorta.scale.set(1 + animationIntensity * 0.25, 1, 1);
            vessels.aortaArch.scale.set(1 + animationIntensity * 0.25, 1 + animationIntensity * 0.25, 1 + animationIntensity * 0.25);
            break;
            
        case "Ventricular Repolarization":
            // T wave - ventricles relax, semilunar valves close, passive ventricular filling begins
            
            // Ventricles relaxing
            const ventriclesRelaxing = 1.0 + (animationIntensity * 0.2);
            rightVentricle.scale.set(ventriclesRelaxing * 1.05, ventriclesRelaxing * 0.95, ventriclesRelaxing);
            leftVentricle.scale.set(ventriclesRelaxing * 1.05, ventriclesRelaxing * 0.95, ventriclesRelaxing);
            rightVentricle.rotation.z = -Math.PI / 12; // Reset rotation
            leftVentricle.rotation.z = -Math.PI / 12;
            
            // Blood begins to fill ventricles passively
            const passiveFilling = 1.0 + (animationIntensity * 0.15);
            bloodVolumes.rightVentricle.scale.set(passiveFilling, passiveFilling, passiveFilling);
            bloodVolumes.leftVentricle.scale.set(passiveFilling, passiveFilling, passiveFilling);
            
            // Atria continue filling
            const atriaFillingContinues = 1.0 + (animationIntensity * 0.2);
            rightAtrium.scale.set(atriaFillingContinues * 1.05, atriaFillingContinues, atriaFillingContinues * 0.95);
            leftAtrium.scale.set(atriaFillingContinues * 1.05, atriaFillingContinues, atriaFillingContinues * 0.95);
            
            // Blood continues to fill atria
            bloodVolumes.rightAtrium.scale.set(atriaFillingContinues * 0.85, atriaFillingContinues * 0.85, atriaFillingContinues * 0.85);
            bloodVolumes.leftAtrium.scale.set(atriaFillingContinues * 0.85, atriaFillingContinues * 0.85, atriaFillingContinues * 0.85);
            
            // Valve animation - AV valves begin to open for passive filling
            const passiveValveAngle = Math.PI * 0.3 * animationIntensity;
            valves.tricuspid.children.forEach(leaflet => {
                leaflet.rotation.z = passiveValveAngle;
            });
            valves.mitral.children.forEach(leaflet => {
                leaflet.rotation.z = passiveValveAngle;
            });
            
            // Semilunar valves close
            valves.pulmonary.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            valves.aortic.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            
            // Ventricles color returns to normal
            rightVentricle.material.color.setRGB(0.5, 0.4, 0.6);
            leftVentricle.material.color.setRGB(0.7, 0.3, 0.3);
            
            // Vessels return to normal
            vessels.pulmonaryArtery.scale.set(1, 1, 1);
            vessels.aorta.scale.set(1, 1, 1);
            vessels.aortaArch.scale.set(1, 1, 1);
            break;
            
        case "Diastole":
            // Heart at rest - all chambers gradually filling
            
            // Gentle pulsing for diastolic filling
            const diastolicPulse = Math.sin(Date.now() * 0.002) * 0.04;
            const diastolicFilling = 1.0 + 0.1 + diastolicPulse;
            
            // All chambers slightly expanded during diastole
            rightAtrium.scale.set(diastolicFilling * 1.05, diastolicFilling, diastolicFilling * 0.95);
            leftAtrium.scale.set(diastolicFilling * 1.05, diastolicFilling, diastolicFilling * 0.95);
            rightVentricle.scale.set(diastolicFilling * 1.05, diastolicFilling * 0.95, diastolicFilling);
            leftVentricle.scale.set(diastolicFilling * 1.05, diastolicFilling * 0.95, diastolicFilling);
            rightAtrium.rotation.z = -Math.PI / 12; // Reset rotation
            leftAtrium.rotation.z = -Math.PI / 12;
            
            // Blood gradually fills all chambers
            const bloodFill = diastolicFilling * 0.9;
            bloodVolumes.rightAtrium.scale.set(bloodFill, bloodFill, bloodFill);
            bloodVolumes.leftAtrium.scale.set(bloodFill, bloodFill, bloodFill);
            bloodVolumes.rightVentricle.scale.set(bloodFill * 0.95, bloodFill * 0.95, bloodFill * 0.95);
            bloodVolumes.leftVentricle.scale.set(bloodFill * 0.95, bloodFill * 0.95, bloodFill * 0.95);
            
            // Valve animation - AV valves partially open for passive filling
            const diastolicValveAngle = Math.PI * 0.2 + diastolicPulse * 0.15;
            valves.tricuspid.children.forEach(leaflet => {
                leaflet.rotation.z = diastolicValveAngle;
            });
            valves.mitral.children.forEach(leaflet => {
                leaflet.rotation.z = diastolicValveAngle;
            });
            
            // Semilunar valves closed
            valves.pulmonary.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            valves.aortic.children.forEach(leaflet => {
                leaflet.rotation.z = 0;
            });
            
            // Subtle color changes during diastole
            rightAtrium.material.color.setRGB(0.5, 0.4, 0.6 + diastolicPulse * 0.1);
            leftAtrium.material.color.setRGB(0.7 + diastolicPulse * 0.1, 0.3, 0.3);
            rightVentricle.material.color.setRGB(0.5, 0.4, 0.6);
            leftVentricle.material.color.setRGB(0.7, 0.3, 0.3);
            
            // Venous return continues
            const venousPulse = 1 + diastolicPulse * 0.6;
            vessels.svc.scale.set(1, venousPulse, 1);
            vessels.ivc.scale.set(venousPulse, 1, 1);
            break;
    }
}

// Global variables
// Mouse rotation variables
let isMouseRotating = false;
let mouseStartX = 0;
let mouseStartY = 0;
let heartRotationStartX = 0;
let heartRotationStartY = 0;
const rotationSensitivity = 0.01; // Adjust sensitivity for rotation
let scene, camera, renderer, heart, controls;
let rightAtrium, leftAtrium, rightVentricle, leftVentricle;
let valves = {}; // All heart valves
let bloodVolumes = {}; // Blood volumes by chamber
let vessels = {}; // Blood vessels
let bloodParticles = []; // Blood particles for visible flow
let ecgData, currentPatientData;
let patientIndex = 0;
let isPlaying = false;
let animationId = null;
let normalizeData = true;
let currentEcgIndex = 0;
let lastBeatTime = Date.now();
let bpmValue = 0;
let ecgCanvas, ecgCtx;
let playbackSpeed = 0.15; // Balanced to show valve movement
let ecgBuffer = []; // Store recent ECG values for analysis
let currentHeartPhase = "Diastole"; // Initial phase
let isEcgDragging = false;
let ecgStartHeight = 200; // Initial ECG height
let dragging = false;
let dragStartY = 0;
let dragStartHeight = 0;

// ECG wave indicator positions
let pWaveStart = -1;
let pWaveEnd = -1;
let qrsStart = -1;
let qrsEnd = -1;
let tWaveStart = -1;
let tWaveEnd = -1;

// Setup ECG graph canvas
function setupEcgCanvas() {
    ecgCanvas = document.getElementById('ecgGraph');
    if (!ecgCanvas) {
        console.error("ECG Canvas element not found!");
        return;
    }
    ecgCanvas.width = window.innerWidth;
    ecgCanvas.height = ecgStartHeight; // Initial height
    ecgCtx = ecgCanvas.getContext('2d');
    ecgCtx.fillStyle = 'rgba(0, 0, 0, 1)'; // Solid black background
    ecgCtx.fillRect(0, 0, ecgCanvas.width, ecgCanvas.height);
    
    // Setup ECG resizing
    setupEcgResize();
}

// Make the ECG graph resizable
function setupEcgResize() {
    const dragHandle = document.createElement('div');
    dragHandle.id = 'ecgDragHandle';
    dragHandle.style.position = 'absolute';
    dragHandle.style.bottom = `${ecgStartHeight}px`;
    dragHandle.style.left = '0';
    dragHandle.style.width = '100%';
    dragHandle.style.height = '10px';
    dragHandle.style.backgroundColor = 'rgba(30, 136, 229, 0.5)';
    dragHandle.style.cursor = 'ns-resize';
    dragHandle.style.zIndex = '20';
    document.body.appendChild(dragHandle);
    
    // Mouse events
    dragHandle.addEventListener('mousedown', function(e) {
        dragging = true;
        dragStartY = e.clientY;
        dragStartHeight = parseInt(getComputedStyle(ecgCanvas).height, 10);
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        
        const deltaY = dragStartY - e.clientY;
        const newHeight = Math.min(Math.max(100, dragStartHeight + deltaY), window.innerHeight * 0.8);
        
        ecgCanvas.style.height = `${newHeight}px`;
        dragHandle.style.bottom = `${newHeight}px`;
        
        updateSceneSizes(newHeight);
    });
    
    document.addEventListener('mouseup', function() {
        dragging = false;
    });
    
    // Touch events
    dragHandle.addEventListener('touchstart', function(e) {
        dragging = true;
        dragStartY = e.touches[0].clientY;
        dragStartHeight = parseInt(getComputedStyle(ecgCanvas).height, 10);
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', function(e) {
        if (!dragging) return;
        const touch = e.touches[0];
        const deltaY = dragStartY - touch.clientY;
        const newHeight = Math.min(Math.max(100, dragStartHeight + deltaY), window.innerHeight * 0.8);
        
        ecgCanvas.style.height = `${newHeight}px`;
        dragHandle.style.bottom = `${newHeight}px`;
        
        updateSceneSizes(newHeight);
    });
    
    document.addEventListener('touchend', function() {
        dragging = false;
    });
}

// Update scene and renderer sizes when ECG is resized
function updateSceneSizes(ecgHeight) {
    if (camera && renderer) {
        const containerHeight = window.innerHeight - ecgHeight;
        camera.aspect = window.innerWidth / containerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, containerHeight);
        render();
    }
}

// Mouse event handlers for rotation
function onMouseDown(event) {
    if (event.button === 0) { // Left mouse button
        isMouseRotating = true;
        mouseStartX = event.clientX;
        mouseStartY = event.clientY;
        heartRotationStartX = heart.rotation.y;
        heartRotationStartY = heart.rotation.x;
        event.preventDefault();
    }
}

function onMouseMove(event) {
    if (isMouseRotating && heart) {
        const deltaX = event.clientX - mouseStartX;
        const deltaY = event.clientY - mouseStartY;
        
        // Update heart rotation
        heart.rotation.y = heartRotationStartX + deltaX * rotationSensitivity;
        heart.rotation.x = heartRotationStartY + deltaY * rotationSensitivity;
        
        // Clamp vertical rotation to prevent flipping
        heart.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, heart.rotation.x));
        
        render();
    }
}

function onMouseUp(event) {
    if (event.button === 0) {
        isMouseRotating = false;
    }
}

// Touch event handlers for rotation
function onTouchStart(event) {
    if (event.touches.length === 1) {
        isMouseRotating = true;
        mouseStartX = event.touches[0].clientX;
        mouseStartY = event.touches[0].clientY;
        heartRotationStartX = heart.rotation.y;
        heartRotationStartY = heart.rotation.x;
        event.preventDefault();
    }
}

function onTouchMove(event) {
    if (isMouseRotating && heart && event.touches.length === 1) {
        const deltaX = event.touches[0].clientX - mouseStartX;
        const deltaY = event.touches[0].clientY - mouseStartY;
        
        heart.rotation.y = heartRotationStartX + deltaX * rotationSensitivity;
        heart.rotation.x = heartRotationStartY + deltaY * rotationSensitivity;
        
        heart.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, heart.rotation.x));
        
        render();
        event.preventDefault();
    }
}

function onTouchEnd(event) {
    isMouseRotating = false;
}

// Initialize the 3D scene with Three.js
function initHeartVisualization(data) {
    // Ensure Three.js is included before running this code
    console.log("Initializing heart visualization with data:", data);
    
    // Store the ECG data
    if (!data || !Array.isArray(data) || data.length === 0) {
        console.error("Invalid or empty ECG data provided!");
        return;
    }
    ecgData = data;
    setupPatientSelector();
    
    // Initial patient data
    currentPatientData = ecgData[0];
    
    // Create the Three.js scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);
    
    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / (window.innerHeight - ecgStartHeight), 0.1, 1000);
    camera.position.z = 5; // Adjusted for larger heart model
    
    // Create renderer with anti-aliasing
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight - ecgStartHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    
    // Add lights
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 0, 5);
    scene.add(directionalLight);
    
    const heartLight = new THREE.PointLight(0xff6666, 1.0, 10);
    heartLight.position.set(0, 0, 0.5);
    scene.add(heartLight);
    
    // Create realistic heart
    createRealisticHeart();
    
    // Add blood particles for visible flow
    createBloodParticles();
    
    // Setup ECG graph canvas
    setupEcgCanvas();
    
    // Disable OrbitControls to use custom rotation
    controls = {
        update: function() {} // Empty update to avoid errors
    };
    
    // Add mouse event listeners for heart rotation
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    // Touch support
    renderer.domElement.addEventListener('touchstart', onTouchStart);
    document.addEventListener('touchmove', onTouchMove);
    document.addEventListener('touchend', onTouchEnd);
    
    // Setup event listeners
    document.getElementById('playButton').addEventListener('click', startAnimation);
    document.getElementById('pauseButton').addEventListener('click', stopAnimation);
    document.getElementById('normalizeButton').addEventListener('click', toggleNormalize);
    document.getElementById('patientSelect').addEventListener('change', changePatient);
    
    if (document.getElementById('speedSlider')) {
        document.getElementById('speedSlider').addEventListener('input', adjustSpeed);
    }
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Initial render
    render();
    
    // Start animation immediately
    startAnimation();
    
    ensureBpmDisplay();
}

// Detect ECG wave components - Improved to better match proper ECG morphology
function detectEcgWaveComponents() {
    if (ecgBuffer.length < 30) return;
    
    // Get normalized values for analysis
    const values = [...ecgBuffer];
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    
    // Thresholds for detection
    const rThreshold = avg + range * 0.6; // Higher threshold for R peak detection
    const pThreshold = avg + range * 0.15; // Lower threshold for P wave
    const tThreshold = avg + range * 0.25; // Medium threshold for T wave
    
    // Find QRS complex (R wave peak) - highest peak in the signal
    let rPeakIdx = -1;
    let rPeakValue = -Infinity;
    
    for (let i = 5; i < values.length - 5; i++) {
        if (values[i] > rPeakValue && values[i] > rThreshold) {
            rPeakValue = values[i];
            rPeakIdx = i;
        }
    }
    
    if (rPeakIdx !== -1) {
        // Find Q wave (first negative deflection before R)
        // Q wave is typically a small downward deflection just before the R peak
        let qIdx = rPeakIdx;
        for (let i = rPeakIdx - 1; i >= Math.max(0, rPeakIdx - 5); i--) {
            if (values[i] < values[i+1] && values[i] < avg) {
                qIdx = i;
                break;
            }
        }
        
        // Find S wave (first negative deflection after R)
        // S wave is a downward deflection immediately after the R peak
        let sIdx = rPeakIdx;
        for (let i = rPeakIdx + 1; i < Math.min(values.length, rPeakIdx + 5); i++) {
            if (values[i] < values[i-1] && values[i] < avg) {
                sIdx = i;
                break;
            }
        }
        
        // Set QRS complex - typically 80-120ms in duration
        qrsStart = Math.max(0, qIdx - 1);
        qrsEnd = Math.min(values.length - 1, sIdx + 2);
        
        // Find P wave (before QRS)
        // P wave is a small, rounded bump 120-200ms before the QRS complex
        let pPeakIdx = -1;
        let pMaxValue = -Infinity;
        
        // Look for P wave in the appropriate time window before QRS
        const pSearchStart = Math.max(0, qrsStart - 15);
        const pSearchEnd = Math.max(0, qrsStart - 3);
        
        for (let i = pSearchStart; i <= pSearchEnd; i++) {
            // Looking for a local maximum that's higher than the baseline
            if (values[i] > pThreshold && values[i] > pMaxValue) {
                if ((i > 0 && values[i] > values[i-1]) && 
                    (i < values.length - 1 && values[i] > values[i+1])) {
                    pPeakIdx = i;
                    pMaxValue = values[i];
                }
            }
        }
        
        if (pPeakIdx !== -1) {
            // Find P wave boundaries
            let pStart = pPeakIdx;
            for (let i = pPeakIdx; i >= Math.max(0, pPeakIdx - 10); i--) {
                if (values[i] < avg) {
                    pStart = i;
                    break;
                }
            }
            
            let pEnd = pPeakIdx;
            for (let i = pPeakIdx; i <= Math.min(values.length - 1, pPeakIdx + 10); i++) {
                if (values[i] < avg) {
                    pEnd = i;
                    break;
                }
            }
            
            pWaveStart = pStart;
            pWaveEnd = pEnd;
        } else {
            // Fallback - estimate P wave location if not clearly detected
            pWaveStart = Math.max(0, qrsStart - 15);
            pWaveEnd = Math.max(0, qrsStart - 5);
        }
        
        // Find T wave (after QRS)
        // T wave is a broader, smooth bump coming after the QRS complex
        let tPeakIdx = -1;
        let tMaxValue = -Infinity;
        
        // Look for T wave in the appropriate time window after QRS
        const tSearchStart = Math.min(values.length - 1, qrsEnd + 5);
        const tSearchEnd = Math.min(values.length - 1, qrsEnd + 20);
        
        for (let i = tSearchStart; i <= tSearchEnd; i++) {
            // Looking for a local maximum that's higher than the threshold
            if (values[i] > tThreshold && values[i] > tMaxValue) {
                if ((i > 0 && values[i] > values[i-1]) && 
                    (i < values.length - 1 && values[i] > values[i+1])) {
                    tPeakIdx = i;
                    tMaxValue = values[i];
                }
            }
        }
        
        if (tPeakIdx !== -1) {
            // Find T wave boundaries
            let tStart = tPeakIdx;
            for (let i = tPeakIdx; i >= Math.max(0, tPeakIdx - 10); i--) {
                if (values[i] < avg) {
                    tStart = i;
                    break;
                }
            }
            
            let tEnd = tPeakIdx;
            for (let i = tPeakIdx; i <= Math.min(values.length - 1, tPeakIdx + 10); i++) {
                if (values[i] < avg) {
                    tEnd = i;
                    break;
                }
            }
            
            tWaveStart = Math.max(qrsEnd, tStart);
            tWaveEnd = tEnd;
        } else {
            // Fallback - estimate T wave location if not clearly detected
            tWaveStart = Math.min(values.length - 1, qrsEnd + 5);
            tWaveEnd = Math.min(values.length - 1, qrsEnd + 15);
        }
    }
}// Create a realistic heart model
function createRealisticHeart() {
    heart = new THREE.Group();
    
    // Materials with realistic properties
    const heartMaterial = new THREE.MeshStandardMaterial({
        color: 0x8b0000, // Dark red for cardiac muscle
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });
    
    const rightSideMaterial = new THREE.MeshStandardMaterial({
        color: 0x4682b4, // Steel blue for deoxygenated blood
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        emissive: 0x1e3a5f,
        emissiveIntensity: 0.2
    });
    
    const leftSideMaterial = new THREE.MeshStandardMaterial({
        color: 0xc71515, // Bright red for oxygenated blood
        roughness: 0.6,
        metalness: 0.1,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        emissive: 0x5f0000,
        emissiveIntensity: 0.2
    });
    
    const valveMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5f5f5, // Off-white for valves
        roughness: 0.8,
        metalness: 0.0,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide
    });
    
    // Heart body - realistic shape using LatheGeometry
    const heartPoints = [];
    for (let i = 0; i < 20; i++) {
        const t = i / 19;
        const x = Math.sin(t * Math.PI) * (1.2 - 0.8 * t);
        const y = 2.0 * (1 - t) - 1.0;
        heartPoints.push(new THREE.Vector2(x, y));
    }
    const heartGeometry = new THREE.LatheGeometry(heartPoints, 32);
    const heartBody = new THREE.Mesh(heartGeometry, heartMaterial);
    heartBody.scale.set(1.5, 1.5, 1.5);
    
    // Right Atrium - smaller, rounded chamber
    const rightAtriumGeometry = new THREE.SphereGeometry(0.6, 32, 32);
    rightAtrium = new THREE.Mesh(rightAtriumGeometry, rightSideMaterial.clone());
    rightAtrium.position.set(1.0, 0.8, 0.3);
    rightAtrium.scale.set(1.0, 1.2, 0.8); // Slightly elongated
    
    // Left Atrium - smaller, rounded chamber
    const leftAtriumGeometry = new THREE.SphereGeometry(0.55, 32, 32);
    leftAtrium = new THREE.Mesh(leftAtriumGeometry, leftSideMaterial.clone());
    leftAtrium.position.set(-1.0, 0.8, 0.3);
    leftAtrium.scale.set(1.0, 1.2, 0.8);
    
    // Right Ventricle - triangular, thinner-walled
    const rightVentricleGeometry = new THREE.SphereGeometry(0.9, 32, 32);
    rightVentricle = new THREE.Mesh(rightVentricleGeometry, rightSideMaterial.clone());
    rightVentricle.position.set(1.0, -0.6, 0.2);
    rightVentricle.scale.set(1.2, 1.0, 0.9); // More triangular
    
    // Left Ventricle - thicker, conical
    const leftVentricleGeometry = new THREE.SphereGeometry(1.0, 32, 32);
    leftVentricle = new THREE.Mesh(leftVentricleGeometry, leftSideMaterial.clone());
    leftVentricle.position.set(-1.0, -0.7, 0.2);
    leftVentricle.scale.set(1.3, 1.1, 0.9); // Thicker and conical
    
    // Create heart valves with realistic leaflet counts
    valves.tricuspid = createValve(0.3, valveMaterial.clone(), 3); // 3 leaflets
    valves.tricuspid.position.set(1.0, 0.1, 0.2);
    valves.tricuspid.rotation.y = Math.PI / 2;
    
    valves.mitral = createValve(0.3, valveMaterial.clone(), 2); // 2 leaflets
    valves.mitral.position.set(-1.0, 0.1, 0.2);
    valves.mitral.rotation.y = Math.PI / 2;
    
    valves.pulmonary = createValve(0.25, valveMaterial.clone(), 3); // 3 leaflets
    valves.pulmonary.position.set(1.5, -0.6, 0.2);
    
    valves.aortic = createValve(0.25, valveMaterial.clone(), 3); // 3 leaflets
    valves.aortic.position.set(-0.5, -0.3, 0.2);
    valves.aortic.rotation.z = Math.PI / 4;
    
    // Create blood vessels with realistic curves
    // Superior vena cava
    const svcPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.0, 1.8, 0.3),
        new THREE.Vector3(1.0, 1.2, 0.3),
        new THREE.Vector3(1.0, 0.8, 0.3)
    ]);
    const svcGeometry = new THREE.TubeGeometry(svcPath, 20, 0.2, 16, false);
    vessels.svc = new THREE.Mesh(svcGeometry, rightSideMaterial.clone());
    
    // Inferior vena cava
    const ivcPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.2, -1.5, 0.3),
        new THREE.Vector3(1.1, -0.9, 0.3),
        new THREE.Vector3(1.0, -0.3, 0.3)
    ]);
    const ivcGeometry = new THREE.TubeGeometry(ivcPath, 20, 0.2, 16, false);
    vessels.ivc = new THREE.Mesh(ivcGeometry, rightSideMaterial.clone());
    
    // Pulmonary artery
    const pulmonaryArteryPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.5, -0.6, 0.2),
        new THREE.Vector3(2.0, -0.6, 0.2),
        new THREE.Vector3(2.5, -0.4, 0.2)
    ]);
    const pulmonaryArteryGeometry = new THREE.TubeGeometry(pulmonaryArteryPath, 20, 0.25, 16, false);
    vessels.pulmonaryArtery = new THREE.Mesh(pulmonaryArteryGeometry, rightSideMaterial.clone());
    
    // Pulmonary veins
    const pulmonaryVein1Path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, 1.2, 0.3),
        new THREE.Vector3(-1.2, 1.0, 0.3),
        new THREE.Vector3(-1.0, 0.8, 0.3)
    ]);
    const pulmonaryVein1Geometry = new THREE.TubeGeometry(pulmonaryVein1Path, 20, 0.15, 16, false);
    vessels.pulmonaryVein1 = new THREE.Mesh(pulmonaryVein1Geometry, leftSideMaterial.clone());
    
    const pulmonaryVein2Path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.5, 0.9, 0.3),
        new THREE.Vector3(-1.2, 0.7, 0.3),
        new THREE.Vector3(-1.0, 0.5, 0.3)
    ]);
    const pulmonaryVein2Geometry = new THREE.TubeGeometry(pulmonaryVein2Path, 20, 0.15, 16, false);
    vessels.pulmonaryVein2 = new THREE.Mesh(pulmonaryVein2Geometry, leftSideMaterial.clone());
    
    // Aorta
    const aortaPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.5, -0.3, 0.2),
        new THREE.Vector3(-0.4, 0.0, 0.2),
        new THREE.Vector3(-0.3, 0.4, 0.2)
    ]);
    const aortaGeometry = new THREE.TubeGeometry(aortaPath, 20, 0.3, 16, false);
    vessels.aorta = new THREE.Mesh(aortaGeometry, leftSideMaterial.clone());
    
    // Aortic arch
    const archPath = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.3, 0.4, 0.2),
        new THREE.Vector3(-0.3, 0.8, 0.2),
        new THREE.Vector3(-0.8, 1.0, 0.2),
        new THREE.Vector3(-1.3, 0.8, 0.2)
    ]);
    const archGeometry = new THREE.TubeGeometry(archPath, 20, 0.25, 16, false);
    vessels.aortaArch = new THREE.Mesh(archGeometry, leftSideMaterial.clone());
    
    // Create blood volumes inside chambers
    const raBloodGeometry = new THREE.SphereGeometry(0.5, 24, 24);
    bloodVolumes.rightAtrium = new THREE.Mesh(raBloodGeometry, rightSideMaterial.clone());
    bloodVolumes.rightAtrium.position.copy(rightAtrium.position);
    bloodVolumes.rightAtrium.material.transparent = true;
    bloodVolumes.rightAtrium.material.opacity = 0.9;
    
    const rvBloodGeometry = new THREE.SphereGeometry(0.8, 24, 24);
    bloodVolumes.rightVentricle = new THREE.Mesh(rvBloodGeometry, rightSideMaterial.clone());
    bloodVolumes.rightVentricle.position.copy(rightVentricle.position);
    bloodVolumes.rightVentricle.material.transparent = true;
    bloodVolumes.rightVentricle.material.opacity = 0.9;
    
    const laBloodGeometry = new THREE.SphereGeometry(0.45, 24, 24);
    bloodVolumes.leftAtrium = new THREE.Mesh(laBloodGeometry, leftSideMaterial.clone());
    bloodVolumes.leftAtrium.position.copy(leftAtrium.position);
    bloodVolumes.leftAtrium.material.transparent = true;
    bloodVolumes.leftAtrium.material.opacity = 0.9;
    
    const lvBloodGeometry = new THREE.SphereGeometry(0.9, 24, 24);
    bloodVolumes.leftVentricle = new THREE.Mesh(lvBloodGeometry, leftSideMaterial.clone());
    bloodVolumes.leftVentricle.position.copy(leftVentricle.position);
    bloodVolumes.leftVentricle.material.transparent = true;
    bloodVolumes.leftVentricle.material.opacity = 0.9;
    
    // Add everything to the heart group
    heart.add(heartBody);
    heart.add(rightAtrium);
    heart.add(leftAtrium);
    heart.add(rightVentricle);
    heart.add(leftVentricle);
    Object.values(valves).forEach(valve => heart.add(valve));
    Object.values(vessels).forEach(vessel => heart.add(vessel));
    Object.values(bloodVolumes).forEach(blood => heart.add(blood));
    
    // Position and rotate the heart for best view
    heart.rotation.z = -Math.PI / 6; // More pronounced tilt for anatomical view
    heart.rotation.y = Math.PI / 4; // Slight rotation to show depth
    heart.position.set(0, -0.5, 0); // Center in view
    
    scene.add(heart);
}

// Create a heart valve
function createValve(radius, material, leafletCount = 3) {
    const valveGroup = new THREE.Group();
    
    const leafletAngle = (2 * Math.PI) / leafletCount;
    
    for (let i = 0; i < leafletCount; i++) {
        const leafletGeometry = new THREE.CircleGeometry(radius, 8, i * leafletAngle, leafletAngle);
        const leaflet = new THREE.Mesh(leafletGeometry, material.clone());
        valveGroup.add(leaflet);
    }
    
    return valveGroup;
}

// Create blood particles for visible flow
function createBloodParticles() {
    // Define blood flow paths
    const paths = [
        // Right side (blue)
        {
            name: 'svc-to-ra',
            start: new THREE.Vector3(1.0, 1.2, 0.3),
            end: new THREE.Vector3(1.0, 0.8, 0.3),
            color: 0x4682b4,
            count: 10
        },
        {
            name: 'ivc-to-ra',
            start: new THREE.Vector3(1.1, -0.9, 0.3),
            end: new THREE.Vector3(1.0, -0.3, 0.3),
            color: 0x4682b4,
            count: 10
        },
        {
            name: 'ra-to-rv',
            start: new THREE.Vector3(1.0, 0.3, 0.3),
            end: new THREE.Vector3(1.0, -0.6, 0.2),
            color: 0x4682b4,
            count: 15
        },
        {
            name: 'rv-to-pa',
            start: new THREE.Vector3(1.0, -0.6, 0.2),
            end: new THREE.Vector3(2.0, -0.6, 0.2),
            color: 0x4682b4,
            count: 15
        },
        
        // Left side (red)
        {
            name: 'pv-to-la',
            start: new THREE.Vector3(-1.2, 1.0, 0.3),
            end: new THREE.Vector3(-1.0, 0.8, 0.3),
            color: 0xc71515,
            count: 10
        },
        {
            name: 'la-to-lv',
            start: new THREE.Vector3(-1.0, 0.3, 0.3),
            end: new THREE.Vector3(-1.0, -0.7, 0.2),
            color: 0xc71515,
            count: 15
        },
        {
            name: 'lv-to-ao',
            start: new THREE.Vector3(-1.0, -0.7, 0.2),
            end: new THREE.Vector3(-0.4, -0.3, 0.2),
            color: 0xc71515,
            count: 10
        },
        {
            name: 'ao-arch',
            start: new THREE.Vector3(-0.3, 0.4, 0.2),
            end: new THREE.Vector3(-0.8, 0.8, 0.2),
            color: 0xc71515,
            count: 10
        }
    ];
    
    // Create particles for each path
    paths.forEach(path => {
        const material = new THREE.MeshBasicMaterial({
            color: path.color,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < path.count; i++) {
            const particle = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 8, 8),
                material.clone()
            );
            
            // Random initial position along path
            const progress = Math.random();
            particle.position.lerpVectors(path.start, path.end, progress);
            
            // Add slight randomization
            particle.position.x += (Math.random() - 0.5) * 0.05;
            particle.position.y += (Math.random() - 0.5) * 0.05;
            particle.position.z += (Math.random() - 0.5) * 0.05;
            
            // Store path data
            particle.userData = {
                path: path.name,
                start: path.start.clone(),
                end: path.end.clone(),
                progress: progress,
                speed: 0.005 + Math.random() * 0.01,
                active: true,
                chamber: getParticleChamberId(path.name)
            };
            
            bloodParticles.push(particle);
            heart.add(particle);
        }
    });
}

// Get chamber ID from path name for blood flow control
function getParticleChamberId(pathName) {
    if (pathName.includes('svc-to-ra') || pathName.includes('ivc-to-ra')) return 'ra-inflow';
    if (pathName === 'ra-to-rv') return 'ra-to-rv';
    if (pathName === 'rv-to-pa') return 'rv-to-pa';
    if (pathName.includes('pv-to-la')) return 'la-inflow';
    if (pathName === 'la-to-lv') return 'la-to-lv';
    if (pathName === 'lv-to-ao' || pathName === 'ao-arch') return 'lv-to-ao';
    return 'other';
}

// Render loop
function render() {
    renderer.render(scene, camera);
}

// Animation loop with mouse rotation controls
function animate() {
    animationId = requestAnimationFrame(animate);
    
    // Update OrbitControls for smooth rotation
    if (controls) {
        controls.update();
    }
    
    if (currentPatientData) {
        // Balanced animation speed
        const slowFactor = 2; 
        if (currentEcgIndex % (Math.round(1/playbackSpeed) * slowFactor) !== 0) {
            currentEcgIndex = (currentEcgIndex + 1) % 140;
            render();
            return;
        }
        
        // Get current ECG value
        let ecgValue = parseFloat(currentPatientData[currentEcgIndex]);
        
        // Update ECG buffer for wave detection
        ecgBuffer.push(ecgValue);
        if (ecgBuffer.length > 30) ecgBuffer.shift();
        
        // Detect ECG wave components periodically
        if (currentEcgIndex % 5 === 0) {
            detectEcgWaveComponents();
        }
        
        // Normalize if needed
        if (normalizeData) {
            const ecgValues = Object.keys(currentPatientData)
                .filter(key => !isNaN(parseInt(key)) && parseInt(key) < 140)
                .map(key => parseFloat(currentPatientData[key]));
                
            const maxVal = Math.max(...ecgValues);
            const minVal = Math.min(...ecgValues);
            
            ecgValue = (ecgValue - minVal) / (maxVal - minVal);
        }
        
        // Determine current phase of cardiac cycle
        updateHeartPhase(currentEcgIndex);
        
        // Animate heart based on cardiac phase
        animateHeartByCycle(currentHeartPhase, ecgValue);
        
        // Update blood particles flow
        animateBloodParticles(currentHeartPhase);
        
        // Calculate heart rate and update display
        updateHeartRate(currentEcgIndex);
        
        // Update ECG graph - single clean wave
        updateSingleEcgWave(currentEcgIndex, ecgValue);
        
        // Increment ECG index
        currentEcgIndex = (currentEcgIndex + 1) % 140;
    }
    
    render();
}