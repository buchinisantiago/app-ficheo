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
        canvas: document.getElementById('canvas'),
        statusMsg: document.getElementById('status-msg'),
        clock: document.getElementById('current-time'),
        welcome: document.getElementById('welcome-msg'),
        btnChangePin: document.getElementById('btn-change-pin'),
        btnTrackManual: document.getElementById('btn-track-manual')
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
                
                // Setear botones según último estado e iniciar polling
                await checkStatusAndToggleButtons();
                startTrackingRequestsPolling();
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

    // Check Employee Status to Toggle Buttons
    async function checkStatusAndToggleButtons() {
        if (!currentUser) return;
        try {
            const res = await fetch('api/get_employee_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ empleado_id: currentUser.id })
            });
            const data = await res.json();
            
            if (data.success) {
                if (data.last_action === 'entrada') {
                    // Ya entró, no puede volver a entrar
                    ui.clockIn.disabled = true;
                    ui.clockIn.classList.add('disabled-btn');
                    ui.clockOut.disabled = false;
                    ui.clockOut.classList.remove('disabled-btn');
                } else {
                    // Salió o no tiene acción hoy, no puede salir
                    ui.clockOut.disabled = true;
                    ui.clockOut.classList.add('disabled-btn');
                    ui.clockIn.disabled = false;
                    ui.clockIn.classList.remove('disabled-btn');
                }
            }
        } catch (e) {
            console.error("Error al obtener estado del operario", e);
        }
    }

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
                    showStatus('Fichaje registrado con éxito!', 'success');
                    stopCamera();
                    switchSection('actions');
                    
                    // Actualizar estado de los botones (deshabilita el que se acaba de usar)
                    await checkStatusAndToggleButtons();
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
    // El tracking automático de fondo fue eliminado temporalmente, 
    // pero mantenemos el worker de solicitudes bajo demanda:
    let solicitudesInterval = null;

    function startTrackingRequestsPolling() {
        if (solicitudesInterval) clearInterval(solicitudesInterval);
        
        solicitudesInterval = setInterval(async () => {
            if (!currentUser) return;
            try {
                const res = await fetch('api/check_tracking_requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ empleado_id: currentUser.id })
                });
                const data = await res.json();
                
                if (data.success && data.has_request) {
                    console.log('¡Solicitud de tracking recibida desde el admin!');
                    showStatus('El administrador solicitó tu ubicación. Enviando...', 'success');
                    
                    navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                            const { latitude, longitude } = pos.coords;
                            await sendTrackingPoint(currentUser.id, latitude, longitude);
                            showStatus('Ubicación requerida enviada.', 'success');
                        },
                        (err) => {
                            sendTrackingError(currentUser.id, err.message);
                            showStatus('Error GPS al intentar enviar ubicación solicitada.', 'error');
                        },
                        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                    );
                }
            } catch (e) {
                console.error("Error consultando solicitudes de tracking");
            }
        }, 15000); // Check every 15 seconds
    }

    // Manual Tracking
    ui.btnTrackManual.addEventListener('click', () => {
        ui.btnTrackManual.disabled = true;
        const originalContent = ui.btnTrackManual.innerHTML;
        ui.btnTrackManual.innerHTML = '<span class="icon">⌛</span> ENVIANDO...';

        showStatus('Obteniendo ubicación...', 'success');

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                await sendTrackingPoint(currentUser.id, latitude, longitude);
                showStatus('Ubicación enviada correctamente', 'success');
                ui.btnTrackManual.innerHTML = originalContent;
                ui.btnTrackManual.disabled = false;
            },
            (err) => {
                sendTrackingError(currentUser.id, err.message);
                showStatus('Error GPS: No se pudo obtener la ubicación', 'error');
                ui.btnTrackManual.innerHTML = originalContent;
                ui.btnTrackManual.disabled = false;
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });

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
