
// Main gesture detection module
class GestureDetector {
    constructor(options = {}) {
        this.options = {
            gestureThreshold: options.gestureThreshold || 1.0,  // Increased sensitivity (lowered threshold)
            timeThreshold: options.timeThreshold || 1800,       // Slightly longer time for gesture (ms)
            cooldownPeriod: options.cooldownPeriod || 2000,     // Reduced cooldown period (ms)
            onGestureDetected: options.onGestureDetected || function() {}
        };
        
        this.isListening = false;
        this.motionData = [];
        this.lastGestureTime = 0;
        this.gestureInProgress = false;
        
        // Bind methods to this instance
        this.startListening = this.startListening.bind(this);
        this.stopListening = this.stopListening.bind(this);
        this.handleDeviceMotion = this.handleDeviceMotion.bind(this);
        this.detectSGesture = this.detectSGesture.bind(this);
    }
    
    startListening() {
        if (this.isListening) return;
        
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            // iOS 13+ requires permission
            DeviceMotionEvent.requestPermission()
                .then(response => {
                    if (response === 'granted') {
                        this.attachMotionListeners();
                        showNotification("Gesture detection active", "info");
                    } else {
                        showNotification("Motion sensor access denied", "error");
                    }
                })
                .catch(error => {
                    console.error('Error requesting motion permission:', error);
                    showNotification("Couldn't access motion sensors", "error");
                });
        } else {
            // Android and older iOS
            this.attachMotionListeners();
            showNotification("Gesture detection active", "info");
        }
    }
    
    attachMotionListeners() {
        window.addEventListener('devicemotion', this.handleDeviceMotion);
        this.isListening = true;
        
        // Add visual indicator for gesture mode
        this.addGestureIndicator();
    }
    
    stopListening() {
        window.removeEventListener('devicemotion', this.handleDeviceMotion);
        this.isListening = false;
        this.motionData = [];
        
        // Remove visual indicator
        this.removeGestureIndicator();
    }
    
    handleDeviceMotion(event) {
        // Skip if cooldown period hasn't elapsed
        const now = Date.now();
        if (now - this.lastGestureTime < this.options.cooldownPeriod) return;
        
        // Start collecting motion data when significant movement is detected
        const accel = event.accelerationIncludingGravity;
        if (!accel) return;
        
        const magnitude = Math.sqrt(accel.x * accel.x + accel.y * accel.y + accel.z * accel.z);
        const threshold = 8; // Reduced threshold for more sensitivity (was 12)
        
        if (!this.gestureInProgress && magnitude > threshold) {
            this.gestureInProgress = true;
            this.motionData = [];
            setTimeout(() => this.detectSGesture(), this.options.timeThreshold);
        }
        
        if (this.gestureInProgress) {
            this.motionData.push({
                x: accel.x,
                y: accel.y,
                z: accel.z,
                timestamp: now
            });
        }
    }
    
    detectSGesture() {
        if (!this.gestureInProgress || this.motionData.length < 8) { // Reduced minimum points from 10 to 8
            this.gestureInProgress = false;
            return;
        }
        
        // Extract movement in x and y axes (phone screen plane)
        const motionX = this.motionData.map(point => point.x);
        const motionY = this.motionData.map(point => point.y);
        
        // Normalize data
        const normalizedX = this.normalizeArray(motionX);
        const normalizedY = this.normalizeArray(motionY);
        
        // Detect 'S' Pattern: Look for signature direction changes
        // An S pattern typically has 3 inflection points in the x-direction
        const inflections = this.countInflections(normalizedX);
        
        // Check for vertical movement that corresponds to S pattern
        const verticalChanges = this.countDirectionChanges(normalizedY);
        
        // S gesture has 2-3 inflection points in x-axis and 1-2 in y-axis
        // Expanded range to be more permissive
        if (inflections >= 2 && inflections <= 5 && verticalChanges >= 1 && verticalChanges <= 4) {
            // Calculate S-pattern confidence score
            const confidence = this.calculateSConfidence(normalizedX, normalizedY);
            
            if (confidence > this.options.gestureThreshold) {
                this.lastGestureTime = Date.now();
                this.options.onGestureDetected();
                
                // Provide haptic feedback if available
                if (navigator.vibrate) {
                    navigator.vibrate(200);
                }
            }
        }
        
        this.gestureInProgress = false;
        this.motionData = [];
    }
    
    normalizeArray(arr) {
        const min = Math.min(...arr);
        const max = Math.max(...arr);
        const range = max - min;
        return range === 0 ? arr.map(() => 0) : arr.map(val => (val - min) / range);
    }
    
    countInflections(data) {
        let inflections = 0;
        let increasing = null;
        
        for (let i = 1; i < data.length; i++) {
            const current = data[i] > data[i-1];
            
            if (increasing !== null && current !== increasing) {
                inflections++;
            }
            
            increasing = current;
        }
        
        return inflections;
    }
    
    countDirectionChanges(data) {
        let changes = 0;
        let prevDirection = null;
        
        for (let i = 1; i < data.length; i++) {
            const diff = data[i] - data[i-1];
            const direction = diff > 0 ? 1 : diff < 0 ? -1 : 0;
            
            if (prevDirection !== null && direction !== 0 && direction !== prevDirection) {
                changes++;
            }
            
            if (direction !== 0) {
                prevDirection = direction;
            }
        }
        
        return changes;
    }
    
    calculateSConfidence(xData, yData) {
        // S pattern typically has a distinctive signature
        // This is a simplified heuristic that could be improved with machine learning
        
        // Check for inflection points in the right sequence
        let score = 0;
        
        // Divide the gesture into 3 segments
        const segmentSize = Math.floor(xData.length / 3);
        
        // First segment should move right then left
        const firstSegmentDelta = xData[segmentSize] - xData[0];
        
        // Middle segment should move left then right
        const middleSegmentDelta = xData[2 * segmentSize] - xData[segmentSize];
        
        // Last segment should move right then left
        const lastSegmentDelta = xData[xData.length - 1] - xData[2 * segmentSize];
        
        // An S shape would typically have this pattern of deltas: positive, negative, positive
        // or negative, positive, negative
        if ((firstSegmentDelta > 0 && middleSegmentDelta < 0 && lastSegmentDelta > 0) ||
            (firstSegmentDelta < 0 && middleSegmentDelta > 0 && lastSegmentDelta < 0)) {
            score += 1.0;
        }
        
        // Check vertical movement - should be generally downward
        const verticalStart = yData[0];
        const verticalEnd = yData[yData.length - 1];
        if (verticalEnd > verticalStart) {
            score += 0.5;
        }
        
        return score;
    }
    
    addGestureIndicator() {
        // Small subtle indicator to show gesture detection is active
        const indicator = document.createElement('div');
        indicator.id = 'gestureIndicator';
        indicator.innerHTML = '<i class="fas fa-hand-point-up"></i>';
        indicator.className = 'gesture-indicator';
        document.body.appendChild(indicator);
        
        // Style with subtle animation
        const style = document.createElement('style');
        style.id = 'gestureIndicatorStyle';
        style.innerHTML = `
            .gesture-indicator {
                position: fixed;
                bottom: 10px;
                right: 10px;
                background-color: rgba(0, 0, 0, 0.4);
                color: white;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                animation: gentle-pulse 3s infinite;
                opacity: 0.6;
            }
            @keyframes gentle-pulse {
                0% { transform: scale(1); opacity: 0.5; }
                50% { transform: scale(1.05); opacity: 0.7; }
                100% { transform: scale(1); opacity: 0.5; }
            }
        `;
        document.head.appendChild(style);
    }
    
    removeGestureIndicator() {
        const indicator = document.getElementById('gestureIndicator');
        const style = document.getElementById('gestureIndicatorStyle');
        if (indicator) indicator.remove();
        if (style) style.remove();
    }
}

// ==== SafeSphere Integration ====

// Wait for the document to be fully loaded
document.addEventListener("DOMContentLoaded", function() {
    // Add the original event listeners
    const originalInitializeApp = window.initializeApp || function() {};
    const originalSetupEventListeners = window.setupEventListeners || function() {};
    
    // Override the initialization function to add gesture support
    window.initializeApp = function() {
        // Call the original function first
        originalInitializeApp();
        
        // Add gesture support if on mobile and start it automatically
        if (window.isMobileDevice) {
            initializeGestureSupport();
        }
    };
    
    // Keep the event listeners setup but remove toggle functionality
    window.setupEventListeners = function() {
        // Call the original function first
        originalSetupEventListeners();
    };
});

// Initialize gesture detection
let gestureDetector = null;

function initializeGestureSupport() {
    // Create detector with callback
    const gestureDetector = new GestureDetector({
        gestureThreshold: 1.0,
        timeThreshold: 1800,
        cooldownPeriod: 2000,
        onGestureDetected: function() {
            showNotification("'S' gesture detected! Redirecting...", "success");
            // Open new.html in a new tab/window
            window.open("geoloc.html", "_blank"); // Corrected line
        }
    });
}
    
    // Start gesture detection immediately rather than waiting for button press
    gestureDetector.startListening();
    
    // Add stylesheet for gesture controls
    addGestureStyles();
    
    // Show tutorial the first time
    showGestureTutorial();
}

// Remove toggle function since detection should be always on
function toggleGestureDetection() {
    // This function is kept for compatibility but doesn't do anything anymore
    return;
}

function addGestureStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        .gesture-tutorial {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            color: white;
            text-align: center;
            padding: 20px;
        }
        
        .gesture-tutorial img {
            max-width: 80%;
            max-height: 50vh;
            margin: 20px 0;
        }
        
        .gesture-tutorial .close-button {
            position: absolute;
            top: 20px;
            right: 20px;
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
        }
    `;
    document.head.appendChild(styleElement);
}

// Show gesture tutorial when activated for the first time
function showGestureTutorial() {
    const hasSeenTutorial = localStorage.getItem('gestureDetectorTutorialSeen');
    if (hasSeenTutorial) return;
    
    const tutorial = document.createElement('div');
    tutorial.className = 'gesture-tutorial';
    tutorial.innerHTML = `
        <button class="close-button"><i class="fas fa-times"></i></button>
        <h2>Gesture Detection Active</h2>
        <p>Draw the letter "S" in the air with your phone to quickly open SafeSphere search!</p>
        <div>
            <img src="/api/placeholder/300/200" alt="S gesture demonstration">
        </div>
        <p>Hold your phone upright and draw an "S" shape from top to bottom.</p>
        <button class="btn-primary">Got It!</button>
    `;
    
    document.body.appendChild(tutorial);
    
    tutorial.querySelector('.close-button').addEventListener('click', function() {
        tutorial.remove();
        localStorage.setItem('gestureDetectorTutorialSeen', 'true');
    });
    
    tutorial.querySelector('.btn-primary').addEventListener('click', function() {
        tutorial.remove();
        localStorage.setItem('gestureDetectorTutorialSeen', 'true');
    });
}

// Override the notification function to make it mobile-friendly if it isn't already
if (typeof showNotification !== 'function') {
    window.showNotification = function(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    };
}