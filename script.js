document.addEventListener('DOMContentLoaded', () => {

    const splash     = document.getElementById('splash');
    const loginPage  = document.getElementById('login-page');
    const dashMain   = document.getElementById('dashboard-main');

    // ── Splash ────────────────────────────────────────────────────────────
    setTimeout(() => {
        if (splash) { splash.style.opacity = '0'; setTimeout(() => { splash.style.display = 'none'; if (loginPage) loginPage.style.display = 'flex'; }, 500); }
    }, 1800);

    // ── Live metrics in hero ──────────────────────────────────────────────
    fetch('http://localhost:3000/api/admin/overview', { headers: { Authorization: `Bearer ${localStorage.getItem('agriToken') || ''}` } })
      .then(r => r.json()).then(d => {
        const s = d.stats || {};
        const f = document.getElementById('m-farms');    if (f) f.textContent = s.farmCount    || '2';
        const a = document.getElementById('m-area');     if (a) a.textContent = (s.farmCount||2)*4+'+ Ha';
        const m = document.getElementById('m-missions'); if (m) m.textContent = s.missionCount || '2';
      }).catch(() => {
        const f = document.getElementById('m-farms');    if (f) f.textContent = '2';
        const a = document.getElementById('m-area');     if (a) a.textContent = '7.7 Ha';
        const m = document.getElementById('m-missions'); if (m) m.textContent = '2';
      });

    // ── Role card selection ───────────────────────────────────────────────
    let selectedRole = null;
    const stepRole  = document.getElementById('step-role');
    const credForm  = document.getElementById('cred-form');
    const credError = document.getElementById('cred-error');
    const loginId   = document.getElementById('login-id');
    const loginPin  = document.getElementById('login-pin');
    const loginBtn  = document.getElementById('login-btn');

    document.querySelectorAll('.role-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedRole = { role: card.dataset.role, id: card.dataset.id, pin: card.dataset.pin, page: card.dataset.page };
            const nameEl = document.getElementById('cred-role-name');
            const labels = { farmer:'Farmer Portal', drone:'Drone Agent Portal', analyst:'Data Analyst Portal', insurance:'Insurance Agent Portal', admin:'System Administrator' };
            if (nameEl) nameEl.textContent = labels[card.dataset.role] || 'Secure Access';
            if (loginId) loginId.value  = selectedRole.id;
            if (loginPin) loginPin.value = selectedRole.pin;
            if (credError) credError.style.display = 'none';
            if (stepRole) stepRole.style.display = 'none';
            if (credForm) credForm.classList.add('visible');
            if (loginBtn) loginBtn.focus();
        });
    });

    const btnBack = document.getElementById('btn-back');
    if (btnBack) btnBack.addEventListener('click', () => {
        if (credForm) credForm.classList.remove('visible');
        if (stepRole) stepRole.style.display = 'block';
        selectedRole = null;
    });

    // ── Login submit ──────────────────────────────────────────────────────
    const doNavigate = (role, page, uid) => {
        if (loginPage) { loginPage.style.opacity = '0'; loginPage.style.transition = 'opacity 0.35s'; }
        setTimeout(() => {
            if (loginPage) loginPage.style.display = 'none';
            if (role === 'farmer') {
                dashMain.style.display = 'flex';
                const fab = document.getElementById('chatbot-fab'); if (fab) fab.style.display = 'flex';
                const ud  = document.getElementById('user-display'); if (ud) ud.textContent = uid;
                initDashboard();
            } else { window.location.href = page; }
        }, 350);
    };

    if (loginBtn) loginBtn.addEventListener('click', async () => {
        if (!selectedRole) return;
        const uid = (loginId?.value || '').trim(), pin = (loginPin?.value || '').trim();
        if (!uid || !pin) { if (credError) { credError.textContent = 'Please enter User ID and PIN.'; credError.style.display = 'block'; } return; }
        loginBtn.textContent = 'Authenticating…'; loginBtn.disabled = true;
        if (credError) credError.style.display = 'none';
        try {
            const user = await AgriAPI.login(uid, pin);
            const pages = { drone: 'dashboard-drone.html', analyst: 'dashboard-analyst.html', insurance: 'dashboard-insurance.html', admin: 'dashboard-admin.html' };
            doNavigate(user.role, pages[user.role] || 'index.html', uid);
        } catch {
            if (uid === selectedRole.id && pin === selectedRole.pin) {
                sessionStorage.setItem('agriRole', selectedRole.role);
                sessionStorage.setItem('agriUser', uid);
                doNavigate(selectedRole.role, selectedRole.page, uid);
            } else {
                if (credError) { credError.textContent = 'Invalid credentials. Please verify and try again.'; credError.style.display = 'block'; }
                if (loginPin) { loginPin.value = ''; loginPin.focus(); }
            }
        } finally { if (loginBtn) { loginBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg> Authenticate & Access Platform'; loginBtn.disabled = false; } }
    });

    if (loginPin) loginPin.addEventListener('keypress', e => { if (e.key === 'Enter' && loginBtn) loginBtn.click(); });


    // --- Core Dashboard Engine ---
    function initDashboard() {
        const map = L.map('map', { zoomControl: false }).setView([30.9009, 75.8572], 12); // Punjab
        globalMap = map; // expose for field marker system
        L.control.zoom({ position: 'bottomright' }).addTo(map);
        map.on('mousemove', e => { const el = document.getElementById('coord-display'); if (el) el.textContent = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`; });


        L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
            attribution: '&copy; Google Maps', maxZoom: 20
        }).addTo(map);

        setTimeout(() => document.getElementById('map').classList.add('map-loaded'), 200);

        // DOM Elements
        let selectedFarmId = null;
        const audioAlert = document.getElementById('alert-sound');
        const dom = {
            name: document.getElementById('selected-field-name'),
            moistVal: document.getElementById('val-moisture'),
            moistBar: document.getElementById('bar-moisture'),
            tempVal: document.getElementById('val-temp'),
            tempBar: document.getElementById('bar-temp'),
            humVal: document.getElementById('val-humidity'),
            humBar: document.getElementById('bar-humidity'),
            status: document.getElementById('val-status'),
            alertsContainer: document.getElementById('alerts-container'),
            alertBadge: document.getElementById('alert-count'),
            btnTrigger: document.getElementById('btn-trigger'),
            btnResolveAll: document.getElementById('btn-resolve-all')
        };

        const createMarkerIcon = (type) => {
            let className = 'map-marker';
            if (type === 'danger') className += ' marker-danger';
            if (type === 'warning') className += ' marker-warning';
            return L.divIcon({ className: 'custom-icon', html: `<div class="${className}"></div>`, iconSize: [24, 24], iconAnchor: [12, 12] });
        };

        const farms = [
            { id: 'Field Alpha', lat: 30.9200, lng: 75.8300, moist: 65, temp: 28.4, hum: 42, type: 'normal' },
            { id: 'Sector 4', lat: 30.8500, lng: 75.8000, moist: 70, temp: 27.0, hum: 40, type: 'normal' },
            { id: 'Zone Beta', lat: 30.8800, lng: 75.9000, moist: 72, temp: 26.5, hum: 38, type: 'normal' },
            { id: 'Field Gamma', lat: 30.9500, lng: 75.8800, moist: 60, temp: 27.8, hum: 45, type: 'normal' }
        ];

        farms.forEach(farm => {
            farm.marker = L.marker([farm.lat, farm.lng], { icon: createMarkerIcon(farm.type) }).addTo(map);
            farm.marker.on('click', () => {
                selectedFarmId = farm.id;
                updateFocusCard();
                map.flyTo([farm.lat, farm.lng], 13, { duration: 1.0 });
            });
        });

        // ── AI Crop Intelligence Overlays ──

        // Helper to create styled popup
        const makePopup = (title, rows) => {
            const rowsHtml = rows.map(r => `<tr><td style="color:#718096;padding:2px 8px 2px 0;font-size:0.78rem;">${r[0]}</td><td style="font-weight:600;font-size:0.78rem;">${r[1]}</td></tr>`).join('');
            return `<div style="font-family:Inter,sans-serif;min-width:180px;"><b style="font-size:0.85rem;color:#1a365d;">${title}</b><table style="margin-top:6px;">${rowsHtml}</table></div>`;
        };

        // --- HEALTHY ZONES (Green) ---
        const zoneHealthy = L.polygon([
            [30.880, 75.820], [30.910, 75.830], [30.905, 75.870], [30.875, 75.860]
        ], { color: '#276749', fillColor: '#276749', fillOpacity: 0.15, weight: 2, dashArray: '6,4' }).addTo(map);
        zoneHealthy.bindPopup(makePopup('Zone Alpha — Healthy Crop', [['Crop','Wheat (Rabi)'],['NDVI Score','0.82 (Excellent)'],['Coverage','340 Ha'],['Status','No Action Required']]));

        const zoneHealthy2 = L.polygon([
            [30.860, 75.870], [30.875, 75.890], [30.860, 75.910], [30.845, 75.895]
        ], { color: '#276749', fillColor: '#276749', fillOpacity: 0.12, weight: 2, dashArray: '6,4' }).addTo(map);
        zoneHealthy2.bindPopup(makePopup('Zone Delta — Healthy Crop', [['Crop','Paddy'],['NDVI Score','0.78 (Good)'],['Coverage','180 Ha'],['Status','Optimal Growth']]));

        // --- WATER STRESS ZONES (Yellow/Amber) ---
        const zoneStress = L.polygon([
            [30.920, 75.880], [30.950, 75.890], [30.940, 75.920], [30.910, 75.910]
        ], { color: '#c05621', fillColor: '#d69e2e', fillOpacity: 0.22, weight: 2 }).addTo(map);
        zoneStress.bindPopup(makePopup('Zone Beta — Water Stress', [['Crop','Mustard'],['Moisture','28% (Critical Low)'],['Coverage','210 Ha'],['Action','Irrigation Required — Priority HIGH']]));

        const zoneStress2 = L.polygon([
            [30.840, 75.840], [30.860, 75.850], [30.855, 75.870], [30.835, 75.860]
        ], { color: '#c05621', fillColor: '#d69e2e', fillOpacity: 0.18, weight: 2 }).addTo(map);
        zoneStress2.bindPopup(makePopup('Zone Epsilon — Dry Soil', [['Crop','Sunflower'],['Moisture','32% (Low)'],['Coverage','95 Ha'],['Action','Schedule Irrigation']]));

        // --- PEST / DANGER ZONES (Red) ---
        const zonePest = L.polygon([
            [30.830, 75.780], [30.860, 75.790], [30.855, 75.810], [30.825, 75.800]
        ], { color: '#9b2c2c', fillColor: '#c53030', fillOpacity: 0.22, weight: 2 }).addTo(map);
        zonePest.bindPopup(makePopup('Zone Gamma — Pest Attack', [['Crop','Cotton'],['Threat','Locusts (High Density)'],['Coverage','150 Ha'],['Action','Drone Spray Dispatched']]));

        const zoneDamaged = L.polygon([
            [30.895, 75.840], [30.910, 75.845], [30.908, 75.858], [30.893, 75.852]
        ], { color: '#9b2c2c', fillColor: '#e53e3e', fillOpacity: 0.25, weight: 2 }).addTo(map);
        zoneDamaged.bindPopup(makePopup('Zone Zeta — Crop Disease', [['Crop','Wheat'],['Disease','Powdery Mildew'],['Affected','42 Ha'],['Action','Fungicide Application — URGENT']]));

        // --- FLOOD / WATER ZONES (Blue) ---
        const zoneFlood = L.polygon([
            [30.875, 75.800], [30.885, 75.810], [30.880, 75.825], [30.870, 75.818]
        ], { color: '#2b6cb0', fillColor: '#3182ce', fillOpacity: 0.25, weight: 2 }).addTo(map);
        zoneFlood.bindPopup(makePopup('Zone Theta — Flood Risk', [['Condition','Waterlogged Soil'],['Depth','8–14 cm standing water'],['Coverage','65 Ha'],['Action','Drainage Assessment Required']]));

        // --- MICRO-ZONE THREAT CIRCLES (pulse markers) ---
        const threatCircles = [
            { lat: 30.842, lng: 75.791, color: '#c53030', label: 'Pest Hotspot' },
            { lat: 30.937, lng: 75.897, color: '#d69e2e', label: 'Soil Moisture Alert' },
            { lat: 30.901, lng: 75.847, color: '#e53e3e', label: 'Disease Detected' },
            { lat: 30.877, lng: 75.812, color: '#2b6cb0', label: 'Flood Zone' },
        ];
        threatCircles.forEach(tc => {
            L.circle([tc.lat, tc.lng], { color: tc.color, fillColor: tc.color, fillOpacity: 0.08, weight: 1.5, radius: 600 }).addTo(map).bindPopup(`<b>${tc.label}</b>`);
        });

        // Collect all AI overlay layers for toggle control
        const aiLayers = [zoneHealthy, zoneHealthy2, zoneStress, zoneStress2, zonePest, zoneDamaged, zoneFlood];

        // Drone Visualization — Waypoint Route System
        const droneIcon = L.divIcon({ className: 'custom-icon', html: `<div class="drone-marker"></div><div class="drone-radar-pulse"></div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
        
        // Define mission waypoints
        const droneWaypoints = [
            [30.9200, 75.8300],
            [30.9400, 75.8500],
            [30.9300, 75.8800],
            [30.9000, 75.9000],
            [30.8700, 75.8700],
            [30.8800, 75.8400]
        ];
        
        let droneMarker = L.marker(droneWaypoints[0], { icon: droneIcon, zIndexOffset: 1000 }).addTo(map);
        
        // Draw planned route (dashed)
        const plannedRoute = L.polyline(droneWaypoints.concat([droneWaypoints[0]]), {
            color: '#3182ce', weight: 2, opacity: 0.3, dashArray: '8, 6'
        }).addTo(map);
        
        // Active trail (solid, builds as drone moves)
        let trailCoords = [droneWaypoints[0]];
        const droneTrail = L.polyline(trailCoords, {
            color: '#1a365d', weight: 3, opacity: 0.7
        }).addTo(map);
        
        // Waypoint markers
        droneWaypoints.forEach((wp, i) => {
            const wpIcon = L.divIcon({ className: 'custom-icon', html: `<div class="drone-path-marker"></div>`, iconSize: [8, 8], iconAnchor: [4, 4] });
            L.marker(wp, { icon: wpIcon, interactive: false }).addTo(map);
        });
        
        // Drone state
        let currentWP = 0;
        let nextWP = 1;
        let lerpT = 0;
        const lerpSpeed = 0.03;
        let flightSeconds = 0;
        let droneBattery = 84;
        let droneSignalVal = 98;
        
        // Flight timer
        setInterval(() => { flightSeconds++; }, 1000);
        
        function formatTime(s) {
            const m = Math.floor(s / 60).toString().padStart(2, '0');
            const sec = (s % 60).toString().padStart(2, '0');
            return `${m}:${sec}`;
        }
        
        // Main drone tick
        setInterval(() => {
            lerpT += lerpSpeed;
            
            if (lerpT >= 1) {
                lerpT = 0;
                currentWP = nextWP;
                nextWP = (nextWP + 1) % droneWaypoints.length;
                trailCoords = [droneWaypoints[currentWP]];
            }
            
            const fromPt = droneWaypoints[currentWP];
            const toPt = droneWaypoints[nextWP];
            const lat = fromPt[0] + (toPt[0] - fromPt[0]) * lerpT;
            const lng = fromPt[1] + (toPt[1] - fromPt[1]) * lerpT;
            
            droneMarker.setLatLng([lat, lng]);
            trailCoords.push([lat, lng]);
            droneTrail.setLatLngs(trailCoords);
            
            // Telemetry
            const alt = Math.floor(110 + Math.random() * 20);
            const spd = Math.floor(38 + Math.random() * 12);
            droneSignalVal = Math.max(75, droneSignalVal + (Math.random() > 0.5 ? 0.5 : -0.5));
            if (Math.random() > 0.85 && droneBattery > 10) droneBattery--;
            
            const missionPct = Math.round(((currentWP + lerpT) / droneWaypoints.length) * 100);
            
            // Update DOM
            document.getElementById('drone-alt').innerText = `${alt}m`;
            document.getElementById('drone-speed').innerText = `${spd} km/h`;
            document.getElementById('drone-lat').innerText = `${lat.toFixed(4)}°N`;
            document.getElementById('drone-lng').innerText = `${lng.toFixed(4)}°E`;
            document.getElementById('drone-signal').innerText = `${Math.round(droneSignalVal)}%`;
            document.getElementById('drone-flight-time').innerText = formatTime(flightSeconds);
            document.getElementById('drone-waypoint').innerText = `${currentWP + 1} / ${droneWaypoints.length}`;
            document.getElementById('drone-mission-pct').innerText = `${missionPct}%`;
            document.getElementById('drone-mission-fill').style.width = `${missionPct}%`;
            
            // HUD overlay
            document.getElementById('drone-hud-alt').innerText = `ALT ${alt}m`;
            document.getElementById('drone-hud-gps').innerText = `${lat.toFixed(4)}°N ${lng.toFixed(4)}°E`;
            document.getElementById('drone-hud-spd').innerText = `SPD ${spd}km/h`;
            
            // Battery
            let batEl = document.getElementById('drone-battery');
            if (batEl) {
                batEl.innerText = `${droneBattery}%`;
                let batFill = document.querySelector('#drone-battery + .progress-bar .fill');
                if (batFill) {
                    batFill.style.width = `${droneBattery}%`;
                    batFill.className = droneBattery < 30 ? 'fill danger' : 'fill';
                }
            }
            
            // Signal bar
            let sigFill = document.querySelector('#drone-signal + .progress-bar .fill');
            if (sigFill) sigFill.style.width = `${Math.round(droneSignalVal)}%`;
        }, 800);

        // UI Toggles
        document.querySelectorAll('.toggle-switch').forEach(ts => {
            ts.addEventListener('click', function() {
                this.classList.toggle('active');
                const on = this.classList.contains('active');
                if (this.id === 'tog-drone') {
                    [droneMarker, plannedRoute, droneTrail].forEach(l => on ? map.addLayer(l) : map.removeLayer(l));
                }
                if (this.id === 'tog-ndvi') {
                    [zoneHealthy, zoneHealthy2].forEach(l => on ? map.addLayer(l) : map.removeLayer(l));
                }
                if (this.id === 'tog-water') {
                    [zoneStress, zoneStress2, zoneFlood].forEach(l => on ? map.addLayer(l) : map.removeLayer(l));
                }
                if (this.id === 'tog-pest') {
                    [zonePest, zoneDamaged].forEach(l => on ? map.addLayer(l) : map.removeLayer(l));
                }
            });
        });

        let activeAlerts = [];

        function updateFocusCard() {
            if (!selectedFarmId) return;
            const farm = farms.find(f => f.id === selectedFarmId);
            if (!farm) return;

            dom.name.innerText = `${farm.id} (Live Monitor)`;
            dom.moistVal.innerText = `${farm.moist.toFixed(1)}%`;
            dom.moistBar.style.width = `${farm.moist}%`;
            dom.moistBar.className = farm.moist < 35 ? 'fill danger' : (farm.moist < 50 ? 'fill warning' : 'fill');
            dom.tempVal.innerText = `${farm.temp.toFixed(1)}°C`;
            dom.tempBar.style.width = `${(farm.temp / 45) * 100}%`;
            dom.tempBar.className = farm.temp > 35 ? 'fill danger' : 'fill';
            dom.humVal.innerText = `${farm.hum.toFixed(1)}%`;
            dom.humBar.style.width = `${farm.hum}%`;

            if (farm.moist < 35) {
                dom.status.innerText = 'CRITICAL';
                dom.status.style.color = 'var(--danger-red)';
            } else {
                dom.status.innerText = 'Optimal';
                dom.status.style.color = 'var(--primary-green-dark)';
            }
        }

        function renderAlerts() {
            dom.alertBadge.innerText = `${activeAlerts.length} Alerts`;
            dom.alertBadge.className = activeAlerts.length > 0 ? 'badge badge-red' : 'badge badge-green';

            if (activeAlerts.length === 0) {
                dom.alertsContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem; text-align: center; margin: 20px 0;">Network Stable. No alerts detected.</p>';
                return;
            }

            dom.alertsContainer.innerHTML = activeAlerts.map(alert => `
              <div class="alert-item" id="alert-${alert.farmId.replace(' ', '-')}">
                <div class="alert-icon-wrapper red-bg">
                   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01"/></svg>
                </div>
                <div class="alert-content">
                  <h4>${alert.title} - ${alert.farmId}</h4>
                  <p>${alert.message}</p>
                  <button class="action-btn-small primary" onclick="resolveIssue('${alert.farmId}')">Address Issue</button>
                </div>
              </div>
          `).join('');
        }

        window.resolveIssue = function (farmId) {
            const farm = farms.find(f => f.id === farmId);
            if (farm) {
                farm.moist = 75 + Math.random() * 10;
                farm.temp = 25 + Math.random() * 4;
                farm.type = 'normal';
                farm.marker.setIcon(createMarkerIcon('normal'));
            }
            activeAlerts = activeAlerts.filter(a => a.farmId !== farmId);
            renderAlerts();
            if (selectedFarmId === farmId) updateFocusCard();
        };

        function checkThresholds() {
            farms.forEach(farm => {
                if (farm.moist < 35) {
                    if (farm.type !== 'danger') {
                        farm.type = 'danger';
                        farm.marker.setIcon(createMarkerIcon('danger'));
                        if (!activeAlerts.find(a => a.farmId === farm.id)) {
                            activeAlerts.push({
                                farmId: farm.id, title: 'Critical Drought Deficit',
                                message: `Soil moisture plummeted to ${farm.moist.toFixed(1)}%. Immediate irrigation required.`
                            });
                            audioAlert.play().catch(e => console.log('Audio disabled'));
                            renderAlerts();
                        }
                    }
                } else if (farm.moist >= 35 && farm.type === 'danger') {
                    farm.type = 'normal';
                    farm.marker.setIcon(createMarkerIcon('normal'));
                    activeAlerts = activeAlerts.filter(a => a.farmId !== farm.id);
                    renderAlerts();
                }
            });
        }

        setInterval(() => {
            farms.forEach(farm => {
                farm.moist -= (Math.random() * 1.5 + 0.1);
                farm.temp += (Math.random() * 1.0 - 0.5);
                farm.hum += (Math.random() * 2.0 - 1.0);
                if (farm.moist < 0) farm.moist = 0;
            });
            checkThresholds();
            updateFocusCard();
        }, 3000);

        dom.btnTrigger.addEventListener('click', () => {
            const target = farms.find(f => f.id === 'Field Alpha');
            target.moist = 20.5; target.temp = 38.0;
            checkThresholds(); updateFocusCard();
        });

        dom.btnResolveAll.addEventListener('click', () => resolveAllSensors());

        function resolveAllSensors() {
            farms.forEach(farm => {
                farm.moist = 80 + Math.random() * 5;
                farm.temp = 24 + Math.random() * 2;
                farm.type = 'normal';
                farm.marker.setIcon(createMarkerIcon('normal'));
            });
            activeAlerts = [];
            renderAlerts();
            updateFocusCard();
        }

        // Export resolve for Chatbot usage
        window.triggerResolveAll = resolveAllSensors;

        // Top Navigation Connections
        const btnVoice = document.getElementById('btn-voice');
        const voiceLangNav = document.getElementById('voice-lang');
        const searchInput = document.querySelector('.search-bar input');

        if (btnVoice) {
            btnVoice.addEventListener('click', () => {
                document.getElementById('chat-window').classList.remove('hidden');
                document.getElementById('chat-lang').value = voiceLangNav.value;
                document.getElementById('chat-mic').click();
            });
        }
        
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const term = searchInput.value.toLowerCase();
                    const matched = farms.find(f => f.id.toLowerCase().includes(term));
                    if (matched) {
                        matched.marker.fire('click');
                    } else {
                        searchInput.value = "";
                        searchInput.placeholder = "Field not found...";
                        setTimeout(() => searchInput.placeholder = "Search fields, crops, or zones...", 2000);
                    }
                }
            });
        }
    }

    // --- AgriBot Multilingual Chatbot ---
    const chatFab = document.getElementById('chat-fab');
    const chatWindow = document.getElementById('chat-window');
    const closeChat = document.getElementById('close-chat');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const chatMic = document.getElementById('chat-mic');
    const chatLang = document.getElementById('chat-lang');

    chatFab.addEventListener('click', () => chatWindow.classList.remove('hidden'));
    closeChat.addEventListener('click', () => chatWindow.classList.add('hidden'));

    // Sync Navigation Lang with Chat Lang globally
    const voiceLangNav = document.getElementById('voice-lang');
    if (voiceLangNav) {
        voiceLangNav.addEventListener('change', (e) => {
            chatLang.value = e.target.value;
        });
    }
    chatLang.addEventListener('change', (e) => {
        if (voiceLangNav) voiceLangNav.value = e.target.value;
    });

    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${sender}`;
        // Convert simple markdown to HTML safely
        const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
        msgDiv.innerHTML = formattedText;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function speakResponse(text, lang) {
        if ('speechSynthesis' in window) {
            // Clean markdown for speech
            const cleanText = text.replace(/[*#_]/g, '');
            const utterance = new SpeechSynthesisUtterance(cleanText);
            utterance.lang = lang;
            // slow down speech slightly for non-english languages for clarity
            utterance.rate = lang === 'en-IN' ? 1.0 : 0.9;
            
            // Explicitly force the voice engine to match the selected language
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                const exactVoice = voices.find(v => v.lang === lang || v.lang.replace('_', '-') === lang);
                const partialVoice = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
                if (exactVoice) utterance.voice = exactVoice;
                else if (partialVoice) utterance.voice = partialVoice;
            }
            
            window.speechSynthesis.speak(utterance);
        }
    }

    // Pre-load voices
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    // --- AI API Configuration ---
    const GEMINI_API_KEY = "AIzaSyB2q8bQI3BkHwqo58yhYEuCDUcL4AM-SnA"; // Replace with real Gemini API key for true automated solutions
    async function fetchAIResponse(problem, langCode) {
        if (GEMINI_API_KEY === "YOUR_API_KEY_HERE" || !GEMINI_API_KEY.startsWith("AIza")) {
            return null; // Fallback to mock dictionary if no key is provided
        }

        let modelName = "models/gemini-1.5-flash";
        let url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        
        // Hard-map codes to explicit names to ensure the AI definitely outputs the correct dialect
        const languageMap = {
            'en-IN': 'English', 'hi-IN': 'Hindi', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
            'ml-IN': 'Malayalam', 'kn-IN': 'Kannada', 'pa-IN': 'Punjabi', 'mr-IN': 'Marathi'
        };
        const languageName = languageMap[langCode] || langCode;

        const prompt = `You are AgriBot, an expert agricultural AI assistant for a smart dashboard called AgriTrace X. 
      IMPORTANT: The user has selected the language: ${languageName}.
      Regardless of the language the farmer's question is written in, YOU MUST TRANSLATE YOUR THOUGHTS AND REPLY STRICTLY AND ONLY IN ${languageName}.
      Please provide a highly practical, 2-sentence solution to their farming problem in the native script of ${languageName}.
      Farmer's question: "${problem}"`;

        try {
          let res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          let data = await res.json();
          
          // --- Auto-Discovery Model Correction ---
          if (data.error && data.error.message.includes("is not found")) {
              console.log("Model rejected by Google. Attempting auto-discovery of valid models...");
              const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
              const listData = await listRes.json();
              
              if (listData.models && listData.models.length > 0) {
                  // Find any model that their key allows which specifically supports generateContent
                  const validModel = listData.models.find(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
                  if (validModel) {
                      url = `https://generativelanguage.googleapis.com/v1beta/${validModel.name}:generateContent?key=${GEMINI_API_KEY}`;
                      res = await fetch(url, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                      });
                      data = await res.json();
                  } else {
                      return `[API ERROR] Your API Key is valid, but your Google Cloud account is blocking generative models entirely. Please check billing or permissions on AI Studio.`;
                  }
              }
          }

          if (data.error) {
              console.error("Gemini API Error:", data.error.message);
              return `[API ERROR] ${data.error.message}`;
          }

          if (data.candidates && data.candidates[0].content.parts[0].text) {
              return data.candidates[0].content.parts[0].text;
          }
      } catch (e) {
          console.error("AI Fetch Connection Error:", e);
      }
      return null;
    }

    // Multilingual NLP Dictionary & True AI Integration
    async function processBotResponse(userInput) {
        const text = userInput.toLowerCase();
        const lang = chatLang.value;

        addMessage("Thinking...", 'bot'); // Typing indicator
        const typingIndicator = chatMessages.lastElementChild;

        let response = await fetchAIResponse(userInput, lang);

        // Hardware integration trigger (Smart resolution)
        const waterKeys = ['water', 'irrigate', 'paani', 'dry', 'sinchai', 'sukha', 'sookh', 'sinchan', 'pani', 'पाणी', 'fix', 'solve', 'theek'];
        if (waterKeys.some(k => text.includes(k))) {
            if (window.triggerResolveAll) window.triggerResolveAll(); // Programmatically water the sensors
        }

        if (!response) {
            // Fallback if no API key is provided
            const pestKeys = ['pest', 'kide', 'bug', 'keere', 'insects', 'kida', 'rog', 'alya', 'किडे', 'रोग'];
            const hasPests = pestKeys.some(k => text.includes(k));
            const needsWater = waterKeys.some(k => text.includes(k));

            if (hasPests) {
                if (lang === 'en-IN') response = "I detect a pest issue. I recommend spraying organic Neem oil today. Drone alert logged.";
                else if (lang === 'hi-IN') response = "Main samajh gaya ki kheton mein kide hain. Main organic neem oil spray karne ki salaah deta hoon.";
                else if (lang === 'pa-IN') response = "Main samajh gya ke khet vich keere han. Main organic neem oil di varton di salah dinda haan.";
                else if (lang === 'mr-IN') response = "Mala samajle ki shetat kide ahet. Me organic neem oil fawaranyacha salla deto.";
                else if (lang === 'ta-IN') response = "பூச்சிகள் உள்ளன. இன்று ஆர்கானிக் வேப்ப எண்ணெய் தெளிக்கவும்.";
                else if (lang === 'te-IN') response = "పురుగుల సమస్యను గుర్తించాను. వేప నూనెను వాడండి.";
                else if (lang === 'ml-IN') response = "കീട പ്രശ്നം കണ്ടെത്തുന്നു. വേപ്പെണ്ണ തളിക്കുക.";
                else if (lang === 'kn-IN') response = "ಕೀಟ ಸಮಸ್ಯೆಯನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗಿದೆ. ಬೇವಿನ ಎಣ್ಣೆಯನ್ನು ಬಳಸಿ.";
                else response = "I detect a pest issue. I recommend spraying organic Neem oil today.";
            }
            else if (needsWater) {
                if (lang === 'en-IN') response = "Detected water distress. I am now activating the smart irrigation pipeline.";
                else if (lang === 'hi-IN') response = "Kheton mein paani ki kami pakdi gayi hai. Main abhi sinchai pranali chalu kar raha hoon.";
                else if (lang === 'pa-IN') response = "Khet vich paani di ghaat mili hai. Main hun sinchai system chalu kar riha haan.";
                else if (lang === 'mr-IN') response = "Shetat panyachi kamtarata ahe. Me ata sinchan pranali chalu karat ahe.";
                else if (lang === 'ta-IN') response = "நீர் பற்றாக்குறை கண்டறியப்பட்டது. பாசன பைப்லைனை செயல்படுத்துகிறேன்.";
                else if (lang === 'te-IN') response = "నీటి కొరతను గుర్తించారు. నీటిపారుదల పైప్‌లైన్‌ను సక్రియం చేస్తున్నాను.";
                else if (lang === 'ml-IN') response = "വെള്ളത്തിൻ്റെ കുറവ് കണ്ടെത്തി. ഇറിഗേഷൻ പൈപ്പ്ലൈൻ സജീവമാക്കുന്നു.";
                else if (lang === 'kn-IN') response = "ನೀರಿನ ಕೊರತೆಯನ್ನು ಪತ್ತೆಹಚ್ಚಲಾಗಿದೆ. ನೀರಾವರಿ ಪೈಪ್‌ಲೈನ್ ಅನ್ನು ಸಕ್ರಿಯಗೊಳಿಸುತ್ತಿದ್ದೇನೆ.";
                else response = "Detected water distress. I am now activating the smart irrigation pipeline.";
            }
            else {
                if (lang === 'en-IN') response = "[No AI Key Detected] I am operating on static mode. Please insert a Gemini API key in script.js to unlock dynamic AI solutions.";
                else if (lang === 'hi-IN') response = "[AI Key Missing] Kripaya map/code mein API Key darj karein takii main dynamic uttar de sakun.";
                else if (lang === 'pa-IN') response = "[AI Key Missing] Kripa karke dynamic jawab layee code vich API Key pao.";
                else if (lang === 'mr-IN') response = "[AI Key Missing] Kharya AI kariyasathi krupaya API Key script.js madhye taka.";
                else if (lang === 'ta-IN') response = "[AI Key Missing] டைனமிக் AI திறக்க, script.js இல் API விசையைச் சேர்க்கவும்.";
                else if (lang === 'te-IN') response = "[AI Key Missing] డైనమిక్ AI అన్‌లాక్ చేయడానికి script.jsలో API కీని చేర్చండి.";
                else if (lang === 'ml-IN') response = "[AI Key Missing] ഡൈനാമിക് ഐ അൺലോക്ക് ചെയ്യാൻ സ്ക്രിപ്റ്റ്.js-ൽ API കീ ചേർക്കുക.";
                else if (lang === 'kn-IN') response = "[AI Key Missing] ಡೈನಾಮಿಕ್ ಎಐ ಅನ್ಲಾಕ್ ಮಾಡಲು ದಯವಿಟ್ಟು ಸ್ಕ್ರಿಪ್ಟ್.ಜೆಎಸ್ ನಲ್ಲಿ ಎಪಿಐ ಕೀಲಿಯನ್ನು ಸೇರಿಸಿ.";
                else response = "[No AI Key Detected] I am operating on static mode. Please insert a Gemini API key in script.js.";
            }
        }

        typingIndicator.innerText = response;
        speakResponse(response, lang);
    }

    chatSend.addEventListener('click', () => {
        const text = chatInput.value.trim();
        if (!text) return;
        addMessage(text, 'user');
        chatInput.value = '';
        processBotResponse(text);
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') chatSend.click();
    });

    // --- Chatbot Voice Recognition ---
    const voiceOverlay = document.getElementById('voice-overlay');
    const voiceLiveText = document.getElementById('voice-live-text');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        
        let liveTranscript = '';
        let voiceHandled = false;

        const processVoiceFinish = () => {
            if (voiceHandled) return;
            voiceHandled = true;
            voiceOverlay.classList.add('hidden');
            
            if (liveTranscript && liveTranscript.trim().length > 0) {
                 addMessage(liveTranscript, 'user');
                 processBotResponse(liveTranscript);
            }
            liveTranscript = '';
        };

        chatMic.addEventListener('click', () => {
            liveTranscript = '';
            voiceHandled = false;
            recognition.lang = chatLang.value;
            
            // Explicitly unlock SpeechSynthesis audio engine for Mobile/Safari
            if ('speechSynthesis' in window) {
                let dummy = new SpeechSynthesisUtterance('');
                dummy.volume = 0;
                window.speechSynthesis.speak(dummy);
            }

            try { recognition.start(); } catch (e) {} // prevent double start errors
            voiceOverlay.classList.remove('hidden');
            voiceLiveText.innerText = "Listening...";
        });

        // Tap overlay to forcefully submit text immediately bridging any browser bugs
        voiceOverlay.addEventListener('click', () => {
            try { recognition.stop(); } catch(e) {}
            processVoiceFinish();
        });

        recognition.onresult = (event) => {
            let current = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                current += event.results[i][0].transcript;
            }
            liveTranscript = current;
            voiceLiveText.innerText = liveTranscript;
        };

        recognition.onerror = (e) => {
            if (e.error === 'no-speech' || e.error === 'aborted') {
                // Ignore standard early exits
            } else {
                voiceLiveText.innerText = `Mic Error: ${e.error}. Permissions allowed?`;
            }
            setTimeout(() => { if (!voiceHandled) processVoiceFinish(); }, 2500);
        };

        recognition.onend = () => {
             processVoiceFinish();
        };
    } else {
        chatMic.style.display = 'none';
    }

}); // end DOMContentLoaded

// ── Field marker system (new government UI) ─────────────────────────────────
let globalMap = null;
let scanMarkers = [], scanHistory = [];

function addFieldMarker() {
    const fieldId  = document.getElementById('scan-field-id')?.value?.trim() || 'FLD-' + Date.now();
    const ndvi     = parseFloat(document.getElementById('scan-ndvi')?.value || 0.70);
    const moisture = parseFloat(document.getElementById('scan-moisture')?.value || 60);
    const status   = document.getElementById('scan-status')?.value || 'healthy';
    if (!globalMap) { showToast('⚠️ Map not ready yet'); return; }

    const center = globalMap.getCenter();
    const jitter = () => (Math.random() - 0.5) * 0.04;
    const lat = center.lat + jitter(), lng = center.lng + jitter();

    const colors = { healthy: '#1e7e4f', risk: '#b45309', critical: '#b91c1c' };
    const color  = colors[status] || '#1e7e4f';

    const icon = L.divIcon({ className: '', html: `<div style="width:16px;height:16px;background:${color};border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`, iconSize:[16,16], iconAnchor:[8,8] });
    const marker = L.marker([lat, lng], { icon }).addTo(globalMap);
    marker.bindPopup(`<div style="font-family:Inter,sans-serif;min-width:160px;"><b style="color:#1a3a5c;font-size:0.85rem;">${fieldId}</b><table style="margin-top:8px;font-size:0.78rem;"><tr><td style="color:#6b7280;padding:2px 6px 2px 0;">NDVI</td><td style="font-weight:700;">${ndvi.toFixed(2)}</td></tr><tr><td style="color:#6b7280;padding:2px 6px 2px 0;">Moisture</td><td style="font-weight:700;">${moisture}%</td></tr><tr><td style="color:#6b7280;padding:2px 6px 2px 0;">Status</td><td style="font-weight:700;color:${color};">${status.toUpperCase()}</td></tr></table></div>`);
    scanMarkers.push({ id: fieldId, lat, lng, status, ndvi, moisture, marker });

    // Add to history list
    scanHistory.unshift({ fieldId, status, ndvi, moisture, time: new Date().toLocaleTimeString() });
    renderScanHistory();
    updateScanStats();
    showToast(`📍 ${fieldId} placed on map`);
}

function renderScanHistory() {
    const el = document.getElementById('scan-history'); if (!el) return;
    if (!scanHistory.length) { el.innerHTML='<p style="font-size:0.75rem;color:var(--text-muted);text-align:center;padding:20px 0;">No scans yet.</p>'; return; }
    const colors = { healthy:'#1e7e4f', risk:'#b45309', critical:'#b91c1c' };
    el.innerHTML = scanHistory.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-bottom:1px solid var(--border);font-size:0.75rem;"><div style="width:8px;height:8px;border-radius:50%;background:${colors[s.status]||'#6b7280'};flex-shrink:0;"></div><div style="flex:1;"><div style="font-weight:600;color:var(--navy);">${s.fieldId}</div><div style="color:var(--text-muted);font-size:0.68rem;">NDVI ${s.ndvi?.toFixed(2)} · ${s.moisture}% · ${s.time}</div></div><span style="font-size:0.65rem;font-weight:700;padding:2px 7px;border-radius:999px;background:${colors[s.status]||'#e5e7eb'}22;color:${colors[s.status]||'#6b7280'};">${s.status}</span></div>`).join('');
}

function updateScanStats() {
    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('stat-markers', scanMarkers.length);
    el('stat-healthy',  scanMarkers.filter(m => m.status === 'healthy').length);
    el('stat-risk',     scanMarkers.filter(m => m.status === 'risk').length);
    el('stat-critical', scanMarkers.filter(m => m.status === 'critical').length);
}

function simulateCluster() {
    if (!globalMap) return;
    for (let i = 0; i < 3; i++) {
        const center = globalMap.getCenter();
        const lat = center.lat + (Math.random() - 0.5) * 0.02;
        const lng = center.lng + (Math.random() - 0.5) * 0.02;
        document.getElementById('scan-field-id').value = 'CLUSTER-' + i;
        document.getElementById('scan-status').value = 'critical';
        document.getElementById('scan-ndvi').value = (0.2 + Math.random() * 0.15).toFixed(2);
        document.getElementById('scan-moisture').value = Math.round(15 + Math.random() * 10);
        addFieldMarker();
    }
    showToast('⚠️ CLUSTER ALERT: 3 critical zones detected!');
}

// ── AI Chatbot ──────────────────────────────────────────────────────────────
function toggleChatbot() {
    const panel = document.getElementById('chatbot-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) document.getElementById('chat-input')?.focus();
}

async function sendChat() {
    const input = document.getElementById('chat-input');
    const msgs  = document.getElementById('chatbot-msgs');
    if (!input || !msgs) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    // User message
    msgs.innerHTML += `<div class="chat-msg user fade-up"><div class="chat-bubble">${text}</div><div class="chat-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    // Thinking indicator
    const thinkId = 'think-' + Date.now();
    msgs.innerHTML += `<div class="chat-msg bot fade-up" id="${thinkId}"><div class="chat-bubble" style="color:var(--text-muted);">Processing your query...</div></div>`;
    msgs.scrollTop = msgs.scrollHeight;

    const renderBotMsg = (reply) => {
        const msgId = 'bot-' + Date.now();
        const plainText = reply.replace(/<[^>]*>/g, '').replace(/[💧🌱📈⚠️🌦️🌾]/g, '').trim();
        const replayBtn = `<button class="tts-replay-btn" onclick="speakReply(this.dataset.text, '${msgId}')" data-text="${plainText.replace(/"/g,'&quot;')}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0-12l-3 3m3-3l3 3"/></svg>
            Play Response
        </button>`;
        msgs.innerHTML += `<div class="chat-msg bot fade-up" id="${msgId}"><div class="chat-bubble">${reply}<br>${replayBtn}<span id="ind-${msgId}"></span></div><div class="chat-time">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
        msgs.scrollTop = msgs.scrollHeight;
        speakReply(plainText, msgId);
    };

    try {
        const token = AgriAPI.getToken();
        const response = await fetch('http://localhost:3000/api/ai/analyze', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
            body: JSON.stringify({ cropType: 'Wheat', currentMoisture: 62, currentNDVI: 0.72, soilN: 180, soilP: 18, soilK: 130, userQuery: text, lat: 30.9009, lng: 75.8572 })
        });
        const data = await response.json();
        document.getElementById(thinkId)?.remove();
        renderBotMsg(buildChatReply(text, data));
    } catch {
        document.getElementById(thinkId)?.remove();
        renderBotMsg(getOfflineReply(text));
    }
}

function buildChatReply(query, data) {
    const q = query.toLowerCase();
    if (q.includes('irrigat') || q.includes('water')) return `💧 <b>Irrigation:</b> ${data.irrigation?.recommendation || 'Soil moisture is at 62% — within optimal range for Wheat. Next irrigation recommended in 3 days.'}`;
    if (q.includes('fertil') || q.includes('npk') || q.includes('soil')) return `🌱 <b>Fertilizer:</b> ${data.fertilizer?.recommendation || 'Soil nutrients are balanced. Nitrogen at 180 kg/Ha — optimal for Wheat. No immediate application needed.'}`;
    if (q.includes('yield') || q.includes('harvest')) return `📈 <b>Yield Prediction:</b> ${data.yield?.recommendation || 'Expected yield: 5.0 MT/Ha — above target. Estimated revenue: ₹5,11,875 at current MSP.'}`;
    if (q.includes('risk') || q.includes('disaster') || q.includes('flood') || q.includes('pest')) return `⚠️ <b>Risk Assessment:</b> ${data.disaster?.recommendation || 'Moderate risk level. Pest outbreak probability is 55% due to high humidity. Recommend routine field scouting.'}`;
    return `🌾 Overall farm health score is <b>${data.overallScore || 83}/100</b>. ${data.irrigation?.recommendation || 'Field conditions are good.'} Ask me about irrigation, fertilizer, yield, or disaster risks for more detail.`;
}

function getOfflineReply(query) {
    const q = query.toLowerCase();
    if (q.includes('irrigat') || q.includes('water')) return '💧 <b>Irrigation:</b> Based on typical Wheat crop requirements, soil moisture of 55–75% is optimal. If below 55%, irrigate within 24 hours. Drip irrigation improves efficiency by 35% over flood methods.';
    if (q.includes('fertil') || q.includes('npk')) return '🌱 <b>Fertilizer:</b> For Wheat (Rabi), recommended NPK is 220:20:150 kg/Ha. Apply Urea (46-0-0) in 2 splits — 50% at sowing, 50% at crown root initiation stage.';
    if (q.includes('yield') || q.includes('harvest')) return '📈 <b>Yield:</b> Punjab Wheat average yield is 4.5–5.2 MT/Ha under optimal conditions. Higher NDVI scores (>0.75) correlate with yields above 5 MT/Ha.';
    if (q.includes('pest') || q.includes('disease')) return '⚠️ <b>Pest Alert:</b> Monitor for aphids and armyworm in Wheat. High humidity (>70%) with temperatures above 28°C creates ideal conditions for Powdery Mildew. Apply Propiconazole fungicide preventively.';
    if (q.includes('weather') || q.includes('rain')) return '🌦️ IMD forecast for Punjab shows 15–20mm rainfall expected in next 7 days. Delay irrigation. Ensure proper drainage in low-lying plots to prevent waterlogging.';
    return '🌾 I\'m your AgriAI agricultural assistant. I can help with irrigation schedules, fertilizer recommendations, yield predictions, pest/disease alerts, and disaster risk analysis. What specific information do you need?';
}

// ── TTS Engine ────────────────────────────────────────────────────────────
const LANG_MAP_TTS = { en:'en-IN', hi:'hi-IN', pa:'pa-IN', ta:'ta-IN', te:'te-IN', mr:'mr-IN', bn:'bn-BD', gu:'gu-IN', kn:'kn-IN', ml:'ml-IN' };

function speakReply(text, msgId) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    // Clean text: strip HTML tags, emojis, special chars
    const clean = text
        .replace(/<[^>]*>/g, '')
        .replace(/[💧🌱📈⚠️🌦️🌾\u{1F300}-\u{1FAFF}]/gu, '')
        .replace(/[₹]/g, 'Rs ')
        .replace(/–/g, ' to ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 400); // up to ~30 seconds of speech

    if (!clean) return;

    const sel      = document.getElementById('lang-select');
    const langCode = LANG_MAP_TTS[(sel?.value || 'en')] || 'en-IN';

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang  = langCode;
    utterance.rate  = 0.88;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Pick the best available voice for the language
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang === langCode && v.localService)
                   || voices.find(v => v.lang === langCode)
                   || voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
                   || null;
    if (preferred) utterance.voice = preferred;

    // Show/hide speaking indicator
    const showIndicator = (id) => {
        const el = document.getElementById('ind-' + id);
        if (!el) return;
        el.innerHTML = `<div class="speaking-indicator">
            <span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span>
            Speaking...
        </div>`;
    };
    const hideIndicator = (id) => {
        const el = document.getElementById('ind-' + id);
        if (el) el.innerHTML = '';
    };

    utterance.onstart = () => { if (msgId) showIndicator(msgId); };
    utterance.onend   = () => { if (msgId) hideIndicator(msgId); };
    utterance.onerror = () => { if (msgId) hideIndicator(msgId); };

    // Chrome bug: voices may not load immediately on first call
    if (!voices.length) {
        window.speechSynthesis.onvoiceschanged = () => {
            const v2 = window.speechSynthesis.getVoices();
            const pref2 = v2.find(v => v.lang === langCode) || null;
            if (pref2) utterance.voice = pref2;
            window.speechSynthesis.speak(utterance);
        };
    } else {
        window.speechSynthesis.speak(utterance);
    }
}

// ── Voice Input (multilingual, Web Speech API) ─────────────────────────────
let voiceRecognizing = false;
let activeRecog = null;

function toggleVoice() {
    const mic       = document.getElementById('chat-mic');
    const chatInput = document.getElementById('chat-input');

    // Stop if already recording
    if (voiceRecognizing) {
        if (activeRecog) activeRecog.stop();
        voiceRecognizing = false;
        if (mic) mic.classList.remove('recording');
        if (mic) mic.title = 'Voice input';
        return;
    }

    // Check browser support
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        showToast('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
        return;
    }

    // Map UI lang code → BCP-47 locale for Speech API
    const langMap = {
        en: 'en-IN',
        hi: 'hi-IN',
        pa: 'pa-IN',
        ta: 'ta-IN',
        te: 'te-IN',
        mr: 'mr-IN',
        bn: 'bn-BD',
        gu: 'gu-IN',
        kn: 'kn-IN',
        ml: 'ml-IN',
    };
    const sel      = document.getElementById('lang-select');
    const langCode = langMap[(sel?.value || 'en')] || 'en-IN';

    const recog          = new SR();
    activeRecog          = recog;
    recog.lang           = langCode;
    recog.interimResults = true;   // show partial results as user speaks
    recog.maxAlternatives = 1;
    recog.continuous     = false;

    // Visual: mic goes red + show placeholder hint
    voiceRecognizing = true;
    if (mic) { mic.classList.add('recording'); mic.title = 'Click to stop recording'; }
    const origPlaceholder = chatInput?.placeholder;
    if (chatInput) chatInput.placeholder = `Listening in ${langCode}...`;

    // Interim: show partial transcript
    recog.onresult = e => {
        let interim = '', final = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t;
            else interim += t;
        }
        if (chatInput) chatInput.value = final || interim;
    };

    recog.onerror = e => {
        voiceRecognizing = false;
        if (activeRecog) { activeRecog = null; }
        if (mic) { mic.classList.remove('recording'); mic.title = 'Voice input'; }
        if (chatInput) chatInput.placeholder = origPlaceholder || 'Ask about crops, irrigation, risks...';
        if (e.error === 'not-allowed' || e.error === 'denied') {
            showToast('Microphone permission denied. Please allow microphone access in your browser.');
        } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
            showToast(`Voice error: ${e.error}`);
        }
    };

    recog.onend = () => {
        voiceRecognizing = false;
        activeRecog = null;
        if (mic) { mic.classList.remove('recording'); mic.title = 'Voice input'; }
        if (chatInput) chatInput.placeholder = origPlaceholder || 'Ask about crops, irrigation, risks...';
        // Auto-send if something was captured
        const captured = chatInput?.value?.trim();
        if (captured) sendChat();
    };

    recog.start();
}

// ── Toast notification ─────────────────────────────────────────────────────
function showToast(msg, duration = 3500) {
    const t = document.getElementById('agri-toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
}



// ── Language switcher ─────────────────────────────────────────────────────
function switchLang(lang) {
    localStorage.setItem('agriLang', lang);
    const names = { en:'English', hi:'Hindi', pa:'Punjabi', ta:'Tamil', te:'Telugu', mr:'Marathi', bn:'Bengali', gu:'Gujarati', kn:'Kannada', ml:'Malayalam' };
    showToast('Voice language set to ' + (names[lang] || lang));
    const input = document.getElementById('chat-input');
    if (input) {
        const hints = { en:'Ask about crops, irrigation, risks...', hi:'फसल, सिंचाई, जोखिम पूछें...', pa:'ਫ਼ਸਲ, ਸਿੰਚਾਈ ਬਾਰੇ ਪੁੱਛੋ...', ta:'பயிர், நீர்ப்பாசனம் பற்றி கேளுங்கள்...', te:'పంట, నీటిపారుదల గురించి అడగండి...' };
        input.placeholder = hints[lang] || hints['en'];
    }
}

// Restore saved language preference on page load
(function restoreLang() {
    var saved = localStorage.getItem('agriLang');
    if (!saved) return;
    var sel = document.getElementById('lang-select');
    if (sel) sel.value = saved;
})();
