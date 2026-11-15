import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const IMAGE = `${import.meta.env.BASE_URL}assets/night-2012.png`;
const UP = new THREE.Color('#ffb454');
const DOWN = new THREE.Color('#58d7cf');
const STABLE = new THREE.Color('#8a9aaa');
const UP_ACTIVE = new THREE.Color('#fff1cc');
const DOWN_ACTIVE = new THREE.Color('#d9fffb');
const START_ANGLE = 0.72;
const RADIUS = 17;
const PLANE_W = 16;
const PLANE_D = 9;
const BAR_Z_SCALE = PLANE_D / PLANE_W;

function clampAngle(value) {
  return Math.min(1.35, Math.max(0.22, value));
}

export default function GlobeView({ notes, regions = [], rows = 16, cols = 16, selected = -1, onUnavailable }) {
  const hostRef = useRef(null);
  const sceneRef = useRef(null);
  const selectedRef = useRef(selected);
  const unavailableRef = useRef(onUnavailable);
  selectedRef.current = selected;
  unavailableRef.current = onUnavailable;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
    } catch (_) {
      unavailableRef.current?.('WebGL is not available in this browser.');
      return undefined;
    }
    if (!renderer.getContext()) {
      unavailableRef.current?.('WebGL is not available in this browser.');
      return undefined;
    }

    let disposed = false;
    let hidden = document.hidden;
    let observer = null;
    let angle = START_ANGLE;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05080e);

    const width = host.clientWidth || 640;
    const height = host.clientHeight || 360;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const placeCamera = () => {
      camera.position.set(0, Math.sin(angle) * RADIUS, Math.cos(angle) * RADIUS);
      camera.lookAt(0, 0, 0);
    };
    placeCamera();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute(
      'aria-label',
      `3D view of all ${rows * cols} grid cells. Changed cells rise above the map; stable cells are shown as low bars.`
    );
    host.append(renderer.domElement);

    const render = () => {
      if (disposed || hidden) return;
      renderer.render(scene, camera);
    };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight || Math.round(w * 9 / 16);
      if (!w || !h) return;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };

    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(resize);
      observer.observe(host);
    }

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden) render();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onContextLost = (event) => {
      event.preventDefault();
      unavailableRef.current?.('The 3D view lost its WebGL context.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(8, 16, 10);
    scene.add(keyLight);

    const planeGeometry = new THREE.PlaneGeometry(PLANE_W, PLANE_D);
    const planeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.02;
    scene.add(plane);

    const grid = new THREE.GridHelper(16, 16, 0x2a3b4f, 0x16222f);
    grid.position.y = 0.005;
    grid.scale.z = BAR_Z_SCALE;
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    scene.add(grid);

    const loader = new THREE.TextureLoader();
    loader.load(
      IMAGE,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        planeMaterial.map = texture;
        planeMaterial.needsUpdate = true;
        render();
      },
      undefined,
      () => {
        // A missing frame leaves the dark plane; the bars still carry the data.
      }
    );

    const bars = [];
    const barByNote = new Map();
    const barGroup = new THREE.Group();
    barGroup.scale.z = BAR_Z_SCALE;
    scene.add(barGroup);
    const dummy = new THREE.Object3D();
    let mesh = null;

    if (rows > 0 && cols > 0 && rows * cols <= 4096) {
      const noteBySource = new Map(notes.map((note) => [note.sourceIndex, note]));
      const regionByCell = new Map(
        regions
          .map((region, sourceIndex) => ({ region, sourceIndex }))
          .filter(({ region }) => Number.isInteger(region.row) && Number.isInteger(region.col))
          .map(({ region, sourceIndex }) => [`${region.row}:${region.col}`, { region, sourceIndex }])
      );
      const displayCells = Array.from({ length: rows * cols }, (_, cellIndex) => {
        const row = Math.floor(cellIndex / cols);
        const col = cellIndex % cols;
        return regionByCell.get(`${row}:${col}`) || {
          region: { row, col, direction: 'stable', signed_change: 0 },
          sourceIndex: -1,
        };
      });
      const maxScore = displayCells.reduce(
        (max, cell) => Math.max(max, Math.abs(Number(cell.region.score) || 0)),
        0
      );
      const geometry = new THREE.BoxGeometry(0.68, 1, 0.68);
      const material = new THREE.MeshStandardMaterial({
        roughness: 0.35,
        metalness: 0.12,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      });
      mesh = new THREE.InstancedMesh(geometry, material, displayCells.length);
      mesh.sortObjects = false;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      displayCells.forEach(({ region, sourceIndex }) => {
        const note = noteBySource.get(sourceIndex);
        const label = String(region.direction || '').trim().toLowerCase();
        const up = label === 'increase' || (!label && Number(region.signed_change) > 0);
        const down = label === 'decrease' || (!label && Number(region.signed_change) < 0);
        const suppliedMagnitude = Number(region.normalized_magnitude);
        const magnitude = Number.isFinite(suppliedMagnitude)
          ? Math.min(1, Math.max(0, suppliedMagnitude))
          : (maxScore > 0 ? Math.min(1, Math.abs(Number(region.score) || 0) / maxScore) : 0);
        const height = up || down ? 0.16 + magnitude * 2.4 : 0.035;
        const x = region.col - (cols - 1) / 2;
        const z = region.row - (rows - 1) / 2;
        const index = bars.length;

        dummy.position.set(x, (up ? 1 : down ? -1 : 0) * height / 2, z);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
        mesh.setColorAt(index, up ? UP : down ? DOWN : STABLE);
        bars.push({ note, x, z, height, up, down });
        if (note) barByNote.set(note, index);
      });

      mesh.count = bars.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      barGroup.add(mesh);
    }

    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.5, 0, -0.5),
        new THREE.Vector3(0.5, 0, -0.5),
        new THREE.Vector3(0.5, 0, 0.5),
        new THREE.Vector3(-0.5, 0, 0.5),
      ]),
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    ring.position.y = 0.02;
    ring.visible = false;
    barGroup.add(ring);

    const setActive = (index) => {
      if (!mesh) return;
      const note = notes[index];
      const activeIndex = note ? barByNote.get(note) : undefined;

      if (activeIndex === undefined) {
        ring.visible = false;
        render();
        return;
      }

      bars.forEach((bar, i) => {
        const color = i === activeIndex
          ? (bar.up ? UP_ACTIVE : DOWN_ACTIVE)
          : (bar.up ? UP : bar.down ? DOWN : STABLE);
        mesh.setColorAt(i, color);
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

      const bar = bars[activeIndex];
      ring.position.set(bar.x, 0.02, bar.z);
      ring.visible = true;
      render();
    };

    sceneRef.current = {
      render,
      setActive,
      tilt(delta) {
        angle = clampAngle(angle + delta);
        placeCamera();
        render();
      },
      reset() {
        angle = START_ANGLE;
        placeCamera();
        render();
      },
    };

    setActive(selectedRef.current);
    render();

    return () => {
      disposed = true;
      sceneRef.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      if (observer) observer.disconnect();

      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((item) => {
            if (item.map) item.map.dispose();
            item.dispose();
          });
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement);
    };
  }, [notes, regions, rows, cols]);

  useEffect(() => {
    if (sceneRef.current) sceneRef.current.setActive(selected);
  }, [selected]);

  return (
    <div className="globe-shell">
      <div ref={hostRef} className="globe-canvas" />
      <div className="globe-controls">
        <button type="button" className="btn btn--small" onClick={() => sceneRef.current?.tilt(0.12)}>
          Tilt up
        </button>
        <button type="button" className="btn btn--small" onClick={() => sceneRef.current?.tilt(-0.12)}>
          Tilt down
        </button>
        <button type="button" className="btn btn--small" onClick={() => sceneRef.current?.reset()}>
          Reset view
        </button>
      </div>
      <p className="globe-note">
        All {rows * cols} grid cells are shown: changed cells rise above the map, while stable cells stay low.
        The view never rotates on its own; use the buttons to change the angle. Full details are in the list below.
      </p>
    </div>
  );
}
