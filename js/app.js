// js/app.js - Main frontend logic

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentUser = null;
    let pendingAction = null; // 'entrada' or 'salida'
    let stream = null;

    // Tracking Variables
    let trackingInterval = null;
    const TRACKING_MS = 60000; // 1 minuto para pruebas (luego cambiar a 3600000 para 1 hora)

    // Registrar Service Worker para PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registrado', reg))
            .catch(err => console.error('SW Falló', err));
    }

    // Elements
    const sections = {
        login: document.getElementById('login-section'),
        actions: document.getElementById('actions-section'),
        camera: document.getElementById('camera-section')
    };

    const ui = {
        employeeSelect: document.getElementById('employee-select'),
        pinInput: document.getElementById('pin-code'),
        btnLogin: document.getElementById('btn-login'),
        clockIn: document.getElementById('btn-clock-in'),
        clockOut: document.getElementById('btn-clock-out'),
        capture: document.getElementById('btn-capture'),
        cancelCamera: document.getElementById('btn-cancel-camera'),
        video: document.getElementById('video'),
        statusMsg: document.getElementById('status-msg'),
        clock: document.getElementById('current-time'),
        welcome: document.getElementById('welcome-msg'),
        btnChangePin: document.getElementById('btn-change-pin')
    };

    // Update Clock
    setInterval(() => {
        ui.clock.textContent = new Date().toLocaleTimeString();
    }, 1000);

    // Initial Fetch: Employees
    async function loadEmployees() {
        try {
            const res = await fetch('api/get_employees');
            const data = await res.json();
            data.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.nombre;
                ui.employeeSelect.appendChild(opt);
            });
        } catch (err) {
            showStatus('Error al cargar empleados', 'error');
        }
    }

    // Login
    ui.btnLogin.addEventListener('click', async () => {
        const empId = ui.employeeSelect.value;
        const pin = ui.pinInput.value;

        if (!empId || !pin) {
            return showStatus('Selecciona empleado e ingresa PIN', 'error');
        }

        try {
            const res = await fetch('api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: empId, pin })
            });
            const data = await res.json();

            if (data.success) {
                currentUser = data.user;

                if (currentUser.rol === 'admin') {
                    showStatus('Redirigiendo a Panel...', 'success');
                    setTimeout(() => location.href = 'admin/index.html', 1000);
                    return;
                }

                ui.welcome.textContent = `Hola, ${currentUser.nombre}`;
                switchSection('actions');
                showStatus('Ingreso correcto', 'success');
            } else {
                showStatus('PIN incorrecto', 'error');
            }
        } catch (err) {
            showStatus('Error de conexión', 'error');
        }
    });

    // Clock Actions
    ui.clockIn.addEventListener('click', () => startFichaje('entrada'));
    ui.clockOut.addEventListener('click', () => startFichaje('salida'));

    // Change PIN
    ui.btnChangePin.addEventListener('click', async () => {
        const newPin = prompt("Ingresa tu NUEVO PIN (4 números):");
        if (!newPin) return;

        if (!/^\d{4}$/.test(newPin)) {
            return alert("El PIN debe ser exactamente de 4 números.");
        }

        const confirmPin = prompt("Vuelve a escribir el NUEVO PIN para confirmar:");
        if (newPin !== confirmPin) {
            return alert("Los PINs no coinciden. Inténtalo de nuevo.");
        }

        try {
            const res = await fetch('api/save_pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: currentUser.id, new_pin: newPin })
            });
            const data = await res.json();

            if (data.success) {
                alert("¡Contraseña actualizada exitosamente!");
            } else {
                alert("Hubo un error al actualizar la contraseña.");
            }
        } catch (e) {
            alert("Error de conexión");
        }
    });

    async function startFichaje(action) {
        pendingAction = action;
        await startCamera();
        switchSection('camera');
    }

    // Camera
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
            ui.video.srcObject = stream;
        } catch (err) {
            showStatus('Error al acceder a la cámara', 'error');
            switchSection('actions');
        }
    }

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            ui.video.srcObject = null;
        }
    }

    ui.cancelCamera.addEventListener('click', () => {
        stopCamera();
        switchSection('actions');
    });

    // Capture and Save
    ui.capture.addEventListener('click', async () => {
        // 1. Capture Photo (comprimida para ahorrar espacio en DB)
        const MAX_WIDTH = 320;
        const scale = Math.min(1, MAX_WIDTH / ui.video.videoWidth);
        ui.canvas.width = ui.video.videoWidth * scale;
        ui.canvas.height = ui.video.videoHeight * scale;
        ui.canvas.getContext('2d').drawImage(ui.video, 0, 0, ui.canvas.width, ui.canvas.height);
        const photoData = ui.canvas.toDataURL('image/jpeg', 0.3); // 30% calidad — solo prueba de asistencia

        // 2. Get Location
        showStatus('Capturando ubicación...', 'success');

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;

            try {
                // 3. Send to Server
                const res = await fetch('api/save_fichaje', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        empleado_id: currentUser.id,
                        tipo: pendingAction,
                        foto: photoData,
                        lat: latitude,
                        lng: longitude
                    })
                });
                const data = await res.json();

                if (data.success) {
                    showStatus(`¡${pendingAction.toUpperCase()} REGISTRADA!`, 'success');
                    stopCamera();

                    // Manejo del tracking si es entrada o salida
                    if (pendingAction === 'entrada') {
                        startTracking(currentUser.id);
                    } else if (pendingAction === 'salida') {
                        stopTracking();
                    }

                    switchSection('actions');
                } else {
                    showStatus('Error al guardar registro', 'error');
                }
            } catch (err) {
                showStatus('Error de red', 'error');
            }
        }, (err) => {
            showStatus('Error GPS: Por favor permite la ubicación', 'error');
        }, { enableHighAccuracy: true });
    });

    // Tracking Continuo (Punto a Punto)
    function startTracking(empId) {
        if (trackingInterval) clearInterval(trackingInterval);
        console.log(`[Tracking] Iniciado para empleado: ${empId}, cada ${TRACKING_MS / 1000}s`);

        // Notificar al Service Worker (intento experimental de background)
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'START_BACKGROUND_TRACKING' });
        }

        trackingInterval = setInterval(() => {
            console.log('[Tracking] Intentando obtener ubicación...');
            navigator.geolocation.getCurrentPosition(
                (pos) => sendTrackingPoint(empId, pos.coords.latitude, pos.coords.longitude),
                (err) => sendTrackingError(empId, err.message),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        }, TRACKING_MS);
    }

    function stopTracking() {
        if (trackingInterval) clearInterval(trackingInterval);
        trackingInterval = null;
        console.log('[Tracking] Detenido por fin de turno');
    }

    async function sendTrackingPoint(empId, lat, lng) {
        try {
            await fetch('api/save_tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleado_id: empId, lat, lng, status: 'ok' })
            });
            console.log(`[Tracking] Puesto OK: ${lat}, ${lng}`);
        } catch (e) {
            console.error('[Tracking] Fallo de red', e);
        }
    }

    async function sendTrackingError(empId, errorMsg) {
        try {
            await fetch('api/save_tracking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleado_id: empId, status: 'error', error: errorMsg })
            });
            console.warn(`[Tracking] Error guardado: ${errorMsg}`);
        } catch (e) { }
    }

    // Helpers
    function switchSection(name) {
        Object.values(sections).forEach(s => s.classList.remove('active'));
        sections[name].classList.add('active');
    }

    function showStatus(msg, type) {
        ui.statusMsg.textContent = msg;
        ui.statusMsg.className = `status-visible status-${type}`;
        setTimeout(() => {
            ui.statusMsg.className = 'status-hidden';
        }, 3000);
    }

    // Init
    loadEmployees();
});
