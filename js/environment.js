// environment.js — Realistic outdoor arena: blue sky, sun, colorful buildings, green ground
import * as THREE from 'three';

export function createEnvironment(scene) {
    // -- Sky-colored fog --
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.006);
    scene.background = new THREE.Color(0x87CEEB);

    // -- Ground: Green grass with subtle grid --
    const floorCanvas = document.createElement('canvas');
    floorCanvas.width = 512;
    floorCanvas.height = 512;
    const fctx = floorCanvas.getContext('2d');

    // Grass base
    fctx.fillStyle = '#3a7d44';
    fctx.fillRect(0, 0, 512, 512);

    // Grass texture variation
    for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const shade = Math.floor(Math.random() * 30);
        fctx.fillStyle = `rgba(${40 + shade}, ${100 + shade}, ${50 + shade}, 0.6)`;
        fctx.fillRect(x, y, 2, 4 + Math.random() * 3);
    }

    // Subtle grid markings (like a sports field)
    fctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    fctx.lineWidth = 1;
    const step = 64;
    for (let i = 0; i <= 512; i += step) {
        fctx.beginPath(); fctx.moveTo(i, 0); fctx.lineTo(i, 512); fctx.stroke();
        fctx.beginPath(); fctx.moveTo(0, i); fctx.lineTo(512, i); fctx.stroke();
    }

    const floorTex = new THREE.CanvasTexture(floorCanvas);
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);

    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
        map: floorTex,
        roughness: 0.9,
        metalness: 0.0,
        color: 0x4a8f54
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    // -- Concrete pad under tower area --
    const padGeo = new THREE.PlaneGeometry(16, 16);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.85, metalness: 0.05 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.receiveShadow = true;
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.01, -15);
    scene.add(pad);

    // -- Skybox: gradient sky dome --
    const skyGeo = new THREE.SphereGeometry(150, 32, 32);
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 1024;
    skyCanvas.height = 512;
    const sctx = skyCanvas.getContext('2d');

    // Sky gradient: light blue top -> white horizon
    const skyGrad = sctx.createLinearGradient(0, 0, 0, 512);
    skyGrad.addColorStop(0, '#2196F3');     // Rich blue top
    skyGrad.addColorStop(0.25, '#64B5F6');  // Medium blue
    skyGrad.addColorStop(0.5, '#90CAF9');   // Light blue
    skyGrad.addColorStop(0.75, '#BBDEFB');  // Very light blue
    skyGrad.addColorStop(1, '#E3F2FD');     // Almost white at horizon
    sctx.fillStyle = skyGrad;
    sctx.fillRect(0, 0, 1024, 512);

    // Clouds
    sctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 25; i++) {
        const cx = Math.random() * 1024;
        const cy = 40 + Math.random() * 200;
        const w = 60 + Math.random() * 120;
        const h = 20 + Math.random() * 30;
        sctx.beginPath();
        sctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
        sctx.fill();
        // Extra puffs
        sctx.beginPath();
        sctx.ellipse(cx - w * 0.4, cy + 5, w * 0.5, h * 0.7, 0, 0, Math.PI * 2);
        sctx.fill();
        sctx.beginPath();
        sctx.ellipse(cx + w * 0.4, cy + 3, w * 0.6, h * 0.8, 0, 0, Math.PI * 2);
        sctx.fill();
    }

    const skyTex = new THREE.CanvasTexture(skyCanvas);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // -- Sun --
    const sunGeo = new THREE.SphereGeometry(5, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xFFEB3B });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(40, 80, -60);
    scene.add(sun);

    // Sun glow
    const glowGeo = new THREE.SphereGeometry(8, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
        color: 0xFFF9C4,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(sun.position);
    scene.add(glow);

    // -- Colorful City Buildings --
    createRealisticCity(scene);

    // -- Lighting: warm sunlight --
    const ambientLight = new THREE.AmbientLight(0x9BB5D0, 0.75);
    scene.add(ambientLight);

    // Hemisphere light for realistic sky/ground bounce
    const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a7d44, 0.5);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xFFF5E1, 1.2);
    dirLight.position.set(40, 50, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 120;
    dirLight.shadow.camera.left = -40;
    dirLight.shadow.camera.right = 40;
    dirLight.shadow.camera.top = 40;
    dirLight.shadow.camera.bottom = -40;
    dirLight.shadow.bias = -0.001;
    scene.add(dirLight);

    // Fill light from the opposite side
    const fillLight = new THREE.DirectionalLight(0xB3E5FC, 0.3);
    fillLight.position.set(-20, 20, 20);
    scene.add(fillLight);

    return { floor, sky, dirLight, sun };
}

function createRealisticCity(scene) {
    const buildingColors = [
        0xC5CAE9, // lavender
        0xBCAAA4, // warm gray
        0xD7CCC8, // light tan
        0xB0BEC5, // blue gray
        0xFFCCBC, // peach
        0xF0F4C3, // light lime
        0xE1BEE7, // light purple
        0xB2DFDB, // teal
        0xFFE0B2, // light orange
        0xF5F5F5, // near white
        0xCFD8DC, // cool gray
        0xDCEDC8, // light green
        0xFFE082, // amber
        0xEF9A9A, // light red
        0x90CAF9, // light blue
    ];

    const windowColors = [0xFFF9C4, 0xB3E5FC, 0xFFFFFF, 0xFFF176, 0xE0E0E0];

    const count = 50;
    const radius = 80;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const dist = radius + (Math.random() - 0.5) * 25;
        const w = 4 + Math.random() * 8;
        const h = 10 + Math.random() * 35;
        const d = 4 + Math.random() * 8;

        const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const buildingGeo = new THREE.BoxGeometry(w, h, d);
        const buildingMat = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.7,
            metalness: 0.05
        });
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.castShadow = true;
        building.position.set(
            Math.cos(angle) * dist,
            h / 2,
            Math.sin(angle) * dist
        );
        building.rotation.y = Math.random() * Math.PI * 0.5;
        scene.add(building);

        // -- Rooftop details --
        if (Math.random() > 0.5) {
            const roofGeo = new THREE.BoxGeometry(w * 0.3, 2, d * 0.3);
            const roofMat = new THREE.MeshStandardMaterial({ color: 0x78909C, roughness: 0.8 });
            const roof = new THREE.Mesh(roofGeo, roofMat);
            roof.position.set(building.position.x, h + 1, building.position.z);
            scene.add(roof);
        }

        // -- Windows --
        const windowCount = Math.floor(Math.random() * 8) + 3;
        const windowColor = windowColors[Math.floor(Math.random() * windowColors.length)];

        for (let j = 0; j < windowCount; j++) {
            const wGeo = new THREE.PlaneGeometry(0.8, 1.0);
            const wMat = new THREE.MeshStandardMaterial({
                color: windowColor,
                emissive: windowColor,
                emissiveIntensity: 0.15,
                roughness: 0.2,
                metalness: 0.5
            });
            const win = new THREE.Mesh(wGeo, wMat);

            const side = Math.random() > 0.5 ? 1 : -1;
            const axis = Math.random() > 0.5 ? 'x' : 'z';
            win.position.copy(building.position);

            if (axis === 'x') {
                win.position.x += (w / 2 + 0.05) * side;
                win.rotation.y = Math.PI / 2;
            } else {
                win.position.z += (d / 2 + 0.05) * side;
            }
            win.position.y = 3 + Math.random() * (h - 6);
            win.position.x += (Math.random() - 0.5) * w * 0.4;
            scene.add(win);
        }
    }

    // -- Trees scattered around --
    for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 50;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        // Skip if too close to tower area
        if (Math.abs(x) < 10 && z > -25 && z < -5) continue;

        createTree(scene, x, z);
    }
}

function createTree(scene, x, z) {
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5D4037, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 1, z);
    trunk.castShadow = true;
    scene.add(trunk);

    // Foliage (3 stacked cones or spheres)
    const foliageColor = [0x2E7D32, 0x388E3C, 0x43A047, 0x4CAF50][Math.floor(Math.random() * 4)];
    const foliageMat = new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.85 });

    if (Math.random() > 0.5) {
        // Round tree
        const fGeo = new THREE.SphereGeometry(1.5 + Math.random() * 0.5, 8, 8);
        const foliage = new THREE.Mesh(fGeo, foliageMat);
        foliage.position.set(x, 3 + Math.random() * 0.5, z);
        foliage.castShadow = true;
        scene.add(foliage);
    } else {
        // Conical tree (pine-like)
        for (let i = 0; i < 3; i++) {
            const radius = 1.5 - i * 0.35;
            const fGeo = new THREE.ConeGeometry(radius, 1.5, 7);
            const foliage = new THREE.Mesh(fGeo, foliageMat);
            foliage.position.set(x, 2 + i * 1.1, z);
            foliage.castShadow = true;
            scene.add(foliage);
        }
    }
}
