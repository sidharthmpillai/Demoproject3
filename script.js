// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyChMhyseh9zwPtFnh2fZIvC1zoGR9xkRnw",
    authDomain: "safesphere-29656.firebaseapp.com",
    databaseURL: "https://safesphere-29656-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "safesphere-29656",
    storageBucket: "safesphere-29656.appspot.com",
    messagingSenderId: "865787650719",
    appId: "1:865787650719:web:71da4fec011b9408edb8aa"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();

document.addEventListener("DOMContentLoaded", function() {
    initializeApp();
    setupEventListeners();
    loadReviews();
});

// ================= CORE APPLICATION SETUP =================
let currentUser = null;
window.isMobileDevice = /Mobi|Android/i.test(navigator.userAgent);

function initializeApp() {
    setOptimalViewport();
    setupInitialState();
    loadUserData();
    updateRatingDisplay();
    
    const hash = window.location.hash.substring(1);
    const sectionId = hash || 'menuSection';
    showSection(sectionId, false);
    history.replaceState({ section: sectionId }, '', hash ? window.location : window.location + '#menuSection');

    if (window.isMobileDevice) setupMobileMenu();
}

function accessContacts() {
    showEmergencyContacts();
}

function setOptimalViewport() {
    const viewportMeta = document.querySelector('meta[name="viewport"]') || document.createElement('meta');
    viewportMeta.name = 'viewport';
    viewportMeta.content = window.isMobileDevice ? 
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0' :
        'width=device-width, initial-scale=1.0';
    document.head.appendChild(viewportMeta);
}

function setupEventListeners() {
    window.addEventListener('resize', handleResize);
    window.addEventListener('popstate', handlePopState);

    // Rating Input
    const ratingInput = document.getElementById("ratingInput");
    if (ratingInput) {
        ratingInput.addEventListener("change", updateRatingDisplay);
        setupTouchRating();
    }

    // Search Input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
        searchInput.addEventListener("keyup", debounce(searchReviews, 300));
    }

    // Mobile Touch Events
    document.querySelectorAll('button, .btn-primary, .btn-secondary').forEach(button => {
        button.addEventListener('touchstart', function() {
            this.classList.add('touch-active');
        });
        button.addEventListener('touchend', function() {
            this.classList.remove('touch-active');
        });
    });
}

// ================= FIREBASE OPERATIONS =================
function registerUser() {
    const userData = {
        name: document.getElementById("nameInput").value.trim(),
        email: document.getElementById("emailInput").value.trim(),
        phone: document.getElementById("phoneInput").value.trim(),
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    if (!validateUser(userData)) return;

    db.ref('users').push(userData)
        .then(() => {
            showNotification("Profile saved successfully!", "success");
            showSection('menuSection');
        })
        .catch(error => handleError(error, "registration"));
}

function submitReview() {
    const reviewData = {
        location: document.getElementById("locationInput").value.trim(),
        review: document.getElementById("reviewInput").value.trim(),
        rating: document.getElementById("ratingInput").value,
        userName: currentUser?.name || "Anonymous",
        timestamp: firebase.database.ServerValue.TIMESTAMP
    };

    if (!validateReview(reviewData)) return;

    db.ref('reviews').push(reviewData)
        .then(() => {
            showNotification("Review submitted successfully!", "success");
            resetReviewForm();
            showSection('menuSection');
            loadReviews();
        })
        .catch(error => handleError(error, "review submission"));
}

function loadReviews() {
    db.ref('reviews').limitToLast(5).on('value', snapshot => {
        const reviews = [];
        snapshot.forEach(child => reviews.push({ id: child.key, ...child.val() }));
        displayRecentReviews(reviews.reverse());
    });
}

function searchReviews() {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    const resultsContainer = document.getElementById("searchResults");
    
    if (!query) {
        resultsContainer.innerHTML = `<div class="empty-state">Enter a location to search</div>`;
        return;
    }

    db.ref('reviews').orderByChild('location')
        .startAt(query)
        .endAt(query + '\uf8ff')
        .once('value', snapshot => {
            const results = [];
            snapshot.forEach(child => results.push({ id: child.key, ...child.val() }));
            displaySearchResults(results);
        });
}

// ================= UI FUNCTIONS =================
function showSection(sectionId, pushState = true) {
    document.querySelectorAll(".container").forEach(section => section.classList.add("hidden"));
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove("hidden");
        if (pushState) history.pushState({ section: sectionId }, '', `#${sectionId}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (window.isMobileDevice) closeMobileMenu();
    adjustForCurrentDevice();
}

function updateRatingDisplay() {
    const rating = parseInt(document.getElementById("ratingInput").value);
    const stars = document.querySelectorAll("#ratingDisplay i");
    
    stars.forEach((star, index) => {
        star.classList.remove("rating-1", "rating-2", "rating-3", "rating-4", "rating-5");
        if (index < rating) star.classList.add(`rating-${rating}`);
    });
}

function setupMobileMenu() {
    if (!document.getElementById('mobileMenu')) {
        const menuButton = document.createElement('button');
        menuButton.className = 'mobile-menu-button';
        menuButton.innerHTML = '<i class="fas fa-bars"></i>';
        
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-menu hidden';
        mobileMenu.innerHTML = `
            <div class="mobile-menu-header">
                <h2>SafeSphere</h2>
                <button id="mobileMenuClose"><i class="fas fa-times"></i></button>
            </div>
            <div class="mobile-menu-items">
                <div onclick="showSection('menuSection')">Home</div>
                <div onclick="showSection('reviewSection')">Write Review</div>
                <div onclick="showSection('searchSection')">Search</div>
                <div onclick="showSection('contactsSection')">Contacts</div>
            </div>
        `;

        document.body.append(menuButton, mobileMenu);
        menuButton.addEventListener('click', toggleMobileMenu);
        document.getElementById('mobileMenuClose').addEventListener('click', closeMobileMenu);
    }
}

function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobileMenu');
    mobileMenu.classList.toggle('hidden');
    document.body.classList.toggle('mobile-menu-open');
}

function closeMobileMenu() {
    document.getElementById('mobileMenu').classList.add('hidden');
    document.body.classList.remove('mobile-menu-open');
}

// ================= HELPER FUNCTIONS =================
function validateUser(user) {
    if (!user.name || !user.email || !user.phone) {
        showNotification("Please fill all required fields", "error");
        return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
        showNotification("Invalid email format", "error");
        return false;
    }
    return true;
}

function validateReview(review) {
    if (!review.location || !review.review) {
        showNotification("Please fill all review fields", "error");
        return false;
    }
    return true;
}

function displayRecentReviews(reviews) {
    const container = document.getElementById("recentReviewsList");
    container.innerHTML = reviews.map(review => `
        <div class="review">
            <div class="review-header">
                <div class="review-location">${review.location}</div>
                <div class="review-rating">
                    ${Array(review.rating).fill('<i class="fas fa-shield-alt"></i>').join('')}
                </div>
            </div>
            <div class="review-content">
                <p class="review-text">${review.review}</p>
                <div class="review-meta">
                    <span class="review-author">${review.userName}</span>
                    <span class="review-date">${new Date(review.timestamp).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function displaySearchResults(results) {
    const container = document.getElementById("searchResults");
    container.innerHTML = results.length > 0 ? 
        results.map(review => `
            <div class="result-card">
                <h4>${review.location}</h4>
                <div class="rating">${'⭐'.repeat(review.rating)}</div>
                <p>${review.review}</p>
                <div class="review-meta">
                    <span>By ${review.userName}</span>
                    <span>${new Date(review.timestamp).toLocaleDateString()}</span>
                </div>
            </div>
        `).join('') :
        `<div class="empty-state">No results found</div>`;
}

function handleResize() {
    const wasMobile = window.isMobileDevice;
    window.isMobileDevice = window.innerWidth < 768;
    
    if (wasMobile !== window.isMobileDevice) {
        if (window.isMobileDevice) setupMobileMenu();
        else document.getElementById('mobileMenu')?.remove();
    }
    adjustForCurrentDevice();
}

function adjustForCurrentDevice() {
    document.querySelectorAll('.review').forEach(review => 
        review.classList.toggle('mobile-review', window.isMobileDevice)
    );
}

function setupTouchRating() {
    document.querySelectorAll('#ratingDisplay i').forEach((star, index) => {
        star.addEventListener('click', () => {
            document.getElementById("ratingInput").value = index + 1;
            updateRatingDisplay();
        });
    });
}

function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), timeout);
    };
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

function handleError(error, context) {
    console.error(`${context} error:`, error);
    showNotification(`Error during ${context}: ${error.message}`, "error");
}

function resetReviewForm() {
    document.getElementById("locationInput").value = "";
    document.getElementById("reviewInput").value = "";
    document.getElementById("ratingInput").value = "3";
    updateRatingDisplay();
}

// ================= ACCELEROMETER GESTURE INTEGRATION =================

// Add this code at the end of your script.js file

let accelData = { x: 0, y: 0, z: 0 };
let lastAccelData = { x: 0, y: 0, z: 0 };
let shakeCount = 0;
let lastShakeTime = 0;
let sosActivated = false;
let sosCooldown = false;
let isAccelerometerAvailable = false;
let accelListening = false;

function initializeAccelerometerGesture() {
    // Check if DeviceMotion is supported
    if (window.DeviceMotionEvent) {
        isAccelerometerAvailable = true;
        
        // Request permission for iOS 13+ devices
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            // Create a button to request permission
            const permButton = document.createElement('button');
            permButton.id = 'accelPermButton';
            permButton.textContent = 'Enable SOS Gesture';
            permButton.className = 'btn-primary';
            permButton.style.position = 'fixed';
            permButton.style.bottom = '20px';
            permButton.style.right = '20px';
            permButton.style.zIndex = '999';
            permButton.style.borderRadius = '50%';
            permButton.style.width = '60px';
            permButton.style.height = '60px';
            permButton.style.padding = '5px';
            permButton.style.fontSize = '12px';
            
            permButton.addEventListener('click', () => {
                DeviceMotionEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            startAccelerometerListening();
                            permButton.remove();
                            showNotification("SOS gesture enabled!", "success");
                        } else {
                            showNotification("Permission denied for motion sensors", "error");
                        }
                    })
                    .catch(error => {
                        console.error('Error requesting motion permission:', error);
                        showNotification("Could not access motion sensors", "error");
                    });
            });
            
            document.body.appendChild(permButton);
        } else {
            // Non-iOS devices don't need permission
            startAccelerometerListening();
        }
    } else {
        console.warn("Device motion not supported on this device");
        showNotification("SOS gesture not available on this device", "error");
    }
    
    // Create hidden SOS indicator
    createSOSIndicator();
}

function startAccelerometerListening() {
    if (accelListening) return;
    
    window.addEventListener('devicemotion', handleDeviceMotion);
    accelListening = true;
    
    // Show a small indicator that gesture recognition is active
    const gestureIndicator = document.createElement('div');
    gestureIndicator.id = 'gestureIndicator';
    gestureIndicator.innerHTML = '<i class="fas fa-shield-alt"></i>';
    
    const style = document.createElement('style');
    style.textContent = `
        #gestureIndicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background-color: rgba(0, 100, 200, 0.7);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(gestureIndicator);
    
    showNotification("SOS gesture activated! Shake phone to trigger emergency mode", "info");
}

function handleDeviceMotion(event) {
    // Get acceleration data
    const acceleration = event.accelerationIncludingGravity;
    if (!acceleration) return;
    
    // Store current acceleration data
    accelData = {
        x: acceleration.x || 0,
        y: acceleration.y || 0,
        z: acceleration.z || 0
    };
    
    // Detect shake gesture
    detectShakeGesture();
    
    // Update last acceleration data
    lastAccelData = { ...accelData };
}

function detectShakeGesture() {
    const currentTime = new Date().getTime();
    const timeDifference = currentTime - lastShakeTime;
    
    // Calculate magnitude of movement
    const deltaX = Math.abs(accelData.x - lastAccelData.x);
    const deltaY = Math.abs(accelData.y - lastAccelData.y);
    const deltaZ = Math.abs(accelData.z - lastAccelData.z);
    
    // Define shake threshold (adjust as needed for sensitivity)
    const shakeThreshold = 15;
    
    // Detect significant movement
    if ((deltaX > shakeThreshold && deltaY > shakeThreshold) || 
        (deltaX > shakeThreshold && deltaZ > shakeThreshold) || 
        (deltaY > shakeThreshold && deltaZ > shakeThreshold)) {
        
        // Only count if enough time passed (prevent counting the same shake multiple times)
        if (timeDifference > 300) {
            shakeCount++;
            lastShakeTime = currentTime;
            
            // Visual feedback for shake detection
            const indicator = document.getElementById('gestureIndicator');
            if (indicator) {
                indicator.style.backgroundColor = 'rgba(255, 100, 100, 0.8)';
                setTimeout(() => {
                    indicator.style.backgroundColor = 'rgba(0, 100, 200, 0.7)';
                }, 200);
            }
            
            // Check for SOS pattern (3 quick shakes within 2 seconds)
            if (shakeCount >= 3) {
                triggerSOS();
                shakeCount = 0;
            }
            
            // Reset shake count if no additional shakes within 2 seconds
            setTimeout(() => {
                if (currentTime - lastShakeTime >= 2000) {
                    shakeCount = 0;
                }
            }, 2000);
        }
    }
}

function triggerSOS() {
    if (sosCooldown) return;
    
    sosActivated = true;
    sosCooldown = true;
    
    // Show SOS indicator
    const sosIndicator = document.getElementById('sosIndicator');
    sosIndicator.classList.add('active');
    
    // Play alert sound if available
    const alertSound = new Audio('https://cdnjs.cloudflare.com/ajax/libs/ion-sound/3.0.7/sounds/bell_ring.mp3');
    alertSound.play().catch(e => console.log('Error playing sound:', e));
    
    // Call emergency contacts
    showEmergencyContacts();
    
    // Vibrate device if supported
    if (navigator.vibrate) {
        // SOS pattern: 3 short, 3 long, 3 short
        navigator.vibrate([200, 200, 200, 200, 200, 500, 500, 200, 500, 200, 500, 200, 200, 200, 200, 200]);
    }
    
    // Reset cooldown after 10 seconds
    setTimeout(() => {
        sosIndicator.classList.remove('active');
        sosCooldown = false;
    }, 10000);
}

function createSOSIndicator() {
    const sosIndicator = document.createElement('div');
    sosIndicator.id = 'sosIndicator';
    sosIndicator.innerHTML = `
        <div class="sos-content">
            <h2><i class="fas fa-exclamation-triangle"></i> SOS ACTIVATED</h2>
            <p>Emergency contacts being notified</p>
            <button id="cancelSOS">Cancel</button>
        </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
        #sosIndicator {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 0, 0, 0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 2000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.3s, visibility 0.3s;
        }
        #sosIndicator.active {
            opacity: 1;
            visibility: visible;
        }
        .sos-content {
            background-color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0.7); }
            70% { box-shadow: 0 0 0 15px rgba(255, 0, 0, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 0, 0, 0); }
        }
        #cancelSOS {
            background-color: #444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            margin-top: 15px;
            cursor: pointer;
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(sosIndicator);
    
    document.getElementById('cancelSOS').addEventListener('click', function() {
        document.getElementById('sosIndicator').classList.remove('active');
        sosActivated = false;
    });
}

function showEmergencyContacts() {
    // Do not call showSection() so that profileSection remains visible
    // Fetch emergency contacts from Firebase
    db.ref('contacts').once('value')
        .then(snapshot => {
            const contacts = [];
            snapshot.forEach(child => contacts.push({ id: child.key, ...child.val() }));
            
            // Display contacts or show a default emergency list
            const contactList = document.getElementById('contactList');
            if (contacts.length > 0) {
                contactList.innerHTML = contacts.map(contact => `
                    <div class="contact-card emergency">
                        <div class="contact-info">
                            <h3>${contact.name}</h3>
                            <p>${contact.phone}</p>
                        </div>
                        <a href="tel:${contact.phone}" class="call-button">
                            <i class="fas fa-phone"></i> Call
                        </a>
                    </div>
                `).join('');
            } else {
                contactList.innerHTML = `
                    <div class="contact-card emergency">
                        <div class="contact-info">
                            <h3>Emergency Services</h3>
                            <p>911</p>
                        </div>
                        <a href="tel:911" class="call-button">
                            <i class="fas fa-phone"></i> Call
                        </a>
                    </div>
                    <div class="contact-card emergency">
                        <div class="contact-info">
                            <h3>Police Department</h3>
                            <p>Non-emergency: 311</p>
                        </div>
                        <a href="tel:311" class="call-button">
                            <i class="fas fa-phone"></i> Call
                        </a>
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error("Error loading contacts:", error);
            document.getElementById('contactList').innerHTML = `
                <div class="contact-card emergency">
                    <div class="contact-info">
                        <h3>Emergency Services</h3>
                        <p>911</p>
                    </div>
                    <a href="tel:911" class="call-button">
                        <i class="fas fa-phone"></i> Call
                    </a>
                </div>
            `;
        });
}

// Add CSS styles for emergency contacts
const emergencyStyles = document.createElement('style');
emergencyStyles.textContent = `
    .contact-card.emergency {
        border: 2px solid #ff3333;
        background-color: #fff8f8;
        animation: emergency-pulse 2s infinite;
    }
    
    .call-button {
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #ff3333;
        color: white;
        padding: 8px 15px;
        border-radius: 5px;
        text-decoration: none;
        font-weight: bold;
    }
    
    .call-button i {
        margin-right: 5px;
    }
    
    @keyframes emergency-pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 51, 51, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(255, 51, 51, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 51, 51, 0); }
    }
`;
document.head.appendChild(emergencyStyles);

// Initialize accelerometer gesture during app startup
document.addEventListener("DOMContentLoaded", function() {
    // Add this line to your existing DOMContentLoaded event handler after the other initializations
    initializeAccelerometerGesture();
});