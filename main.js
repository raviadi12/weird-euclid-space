import "./style.css";

let scene,
  camera,
  renderer,
  player,
  ground,
  directionalLight,
  pointLight,
  composer;
let obstacles = [];
const lanes = [-2, 0, 2];
let currentLane = 1; // Start in the middle lane
const jumpHeight = 4;
const jumpDuration = 700; 
const laneSwitchDuration = 500; 
let jumpStartTime = 0;
let isJumping = false;
let isSwitchingLane = false;
let switchStartTime = 0;
let startLane = 0;
let targetLane = 0;
let currentspeed = 0.1;
let initialCurrentSpeed = 0.1;
let score = 0;
let time = 0;
let lastScoreIncrement = 0;
let mixer;
let playerModel;
// Audio setup
function createSoundPool(audioSrc, poolSize = 3) {
  const soundPool = [];
  for (let i = 0; i < poolSize; i++) {
    const audio = new Audio(audioSrc);
    audio.preload = 'auto';
    soundPool.push(audio);
  }

  let currentIndex = 0;

  return function playSound() {
    const sound = soundPool[currentIndex];
    sound.currentTime = 0; // Reset the audio to the beginning
    sound.play();
    currentIndex = (currentIndex + 1) % poolSize;
  };
}

let loadingScene, loadingCamera, loadingRenderer, loadingCube;
let gameStarted = false;

// Create sound pools
const playObstacleHitSound = createSoundPool('sound/hit.mp3');
const playJumpSound = createSoundPool('sound/jump.mp3');
let cameraBaseY = 5; // The base Y position of the camera
let cameraCurrentY = cameraBaseY;
let cameraTargetY = cameraBaseY;
let cameraLerpFactor = 0.05; // this for smooothiing

// For caching purpose, don't delete this ;/
let cachedRockTexture = null;
let cachedRockGeometry = null;
let cachedBlockadeModel = null;
let playeranimations = null;

function createLoadingScene() {
  loadingScene = new THREE.Scene();
  loadingCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  loadingRenderer = new THREE.WebGLRenderer({ antialias: true });
  loadingRenderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(loadingRenderer.domElement);

  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  loadingCube = new THREE.Mesh(geometry, material);
  loadingScene.add(loadingCube);

  loadingCamera.position.z = 5;

  animateLoadingScene();
}

function animateLoadingScene() {
  requestAnimationFrame(animateLoadingScene);

  loadingCube.rotation.x += 0.01;
  loadingCube.rotation.y += 0.01;
  loadingCube.position.y = Math.sin(Date.now() * 0.003) * 0.5; // Simple jump animation

  loadingRenderer.render(loadingScene, loadingCamera);
}

function showStartScreen() {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('startScreen').style.display = 'flex';
  document.body.removeChild(loadingRenderer.domElement);

  // Show snowboarder in the main scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3264e6);
  setupCamera();
  setupRenderer();
  setupLighting();
  setupGround();
  setupPlayer();
  setupPostProcessing();
  
  // Render the scene without starting the game
  renderer.render(scene, camera);
  animate();
}

function startGame() {
  document.getElementById('startScreen').style.display = 'none';
  gameStarted = true;
  
  // Start the transition from Hello Wave to Idle_2
  transitionToIdleAnimation();

  if (!musicStarted) {
    const music = document.getElementById('backgroundMusic');
    music.play();
    musicStarted = true;
  }
  document.getElementById('scoreOverlay').style.display = 'block';
  document.getElementById('timeOverlay').style.display = 'block';
  spawnObstacle();
}

function transitionToIdleAnimation() {
  const helloWaveAnimation = playeranimations.find(anim => anim.name === "Start_Wave");
  const idleAnimation = playeranimations.find(anim => anim.name === "Idle_2_Victory");

  if (helloWaveAnimation && idleAnimation) {
    const helloWaveAction = mixer.clipAction(helloWaveAnimation);
    const idleAction = mixer.clipAction(idleAnimation);

    // Stop the hello wave animation
    helloWaveAction.fadeOut(0.5);

    // Start the idle animation
    idleAction.reset();
    idleAction.fadeIn(0.5);
    idleAction.play();

    // Optional: you can make the idle animation loop
    idleAction.loop = THREE.LoopRepeat;
  } else {
    console.warn("Hello Wave or Idle animation not found in the model");
  }
}
function preloadAssets(callback) {
  const textureLoader = new THREE.TextureLoader();
  const objLoader = new THREE.OBJLoader();
  const fbxLoader = new THREE.FBXLoader();
  const gltfLoader = new THREE.GLTFLoader();
  

  let assetsLoaded = 0;
  const totalAssets = 4; // Rock texture, Rock OBJ, Blockade FBX, and Player GLB

  function assetLoaded() {
    assetsLoaded++;
    if (assetsLoaded === totalAssets) {
      showStartScreen();
      callback();
    }
  }


  textureLoader.load(
    "Rock-Texture-Surface.jpg",
    function (texture) {
      cachedRockTexture = texture;
      assetLoaded();
    },
    undefined,
    function (error) {
      console.error("Error loading rock texture:", error);
      assetLoaded();
    }
  );

  objLoader.load(
    "Rock1.obj",
    function (object) {
      const rockMesh = object.children.find(
        (child) => child.isMesh && child.name !== "Plane"
      );
      if (rockMesh) {
        cachedRockGeometry = rockMesh.geometry;
        assetLoaded();
      } else {
        console.error("Rock mesh not found in the loaded object");
        assetLoaded();
      }
    },
    undefined,
    function (error) {
      console.error("Error loading rock object:", error);
      assetLoaded();
    }
  );

  fbxLoader.load(
    "FBX/source/Asset barricades 111.fbx",
    function (object) {
      cachedBlockadeModel = object;
      assetLoaded();
    },
    undefined,
    function (error) {
      console.error("Error loading blockade FBX:", error);
      assetLoaded();
    }
  );

  gltfLoader.load(
    "GLTF/source/snowboarder.glb",
    function (gltf) {
      playeranimations = gltf.animations;
      playerModel = gltf.scene;
      mixer = new THREE.AnimationMixer(playerModel);
      const idleAnimation = playeranimations.find(anim => anim.name === "Start_Wave");
      if (idleAnimation) {
        console.log("Idle animation found:", idleAnimation); // Debug log
        const action = mixer.clipAction(idleAnimation);
        action.play();
      } else {
        console.warn("Idle animation not found in the model");
      }
      assetLoaded();
    },
    undefined,
    function (error) {
      console.error("Error loading player GLB:", error);
      assetLoaded();
    }
  );

}

function init() {
  // Setup game but don't start yet ya
  document.addEventListener("keydown", onKeyDown);
  
  document.getElementById('startButton').addEventListener('click', startGame);
}

function updateScoreAndTime() {
  const now = Date.now();
  
  // Update time every second
  if (now - lastScoreIncrement >= 1000) {
    time++;
    score += 10;
    lastScoreIncrement = now;
    
    document.getElementById('scoreValue').textContent = score;
    document.getElementById('timeValue').textContent = time;
  }
}

// Section 2: Camera and Lighting
function setupCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  const frustumSize = 10;
  camera = new THREE.OrthographicCamera(
    (frustumSize * aspect) / -2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    frustumSize / -2,
    0.1,
    1000
  );
  camera.position.set(7, 5, 10);
  camera.lookAt(0, 0, 0);
}

function setupRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
  document.body.appendChild(renderer.domElement);
}

function setupLighting() {
  directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 10, 7);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.near = 1;
  directionalLight.shadow.camera.far = 50; 
  directionalLight.shadow.camera.left = -20;
  directionalLight.shadow.camera.right = 20; 
  directionalLight.shadow.camera.top = 20; 
  directionalLight.shadow.camera.bottom = -20; 
  directionalLight.shadow.mapSize.width = 4096; 
  directionalLight.shadow.mapSize.height = 4096; 
  scene.add(directionalLight);

  // DON'T ADD TO MUCH OR ELSE THE GAME LAGGING

  pointLight = new THREE.PointLight(0xffffff, 0.6);
  pointLight.position.set(0, 5, 0);
  scene.add(pointLight);

  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);
}


// Section 3: Player and Ground
function setupGround() {
  const groundGeometry = new THREE.BoxGeometry(100, 10, 10);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x999999,
    roughness: 0.8,
    metalness: 0.2,
  });
  ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.position.y = -5.5; // Half the height of the cube
  ground.receiveShadow = true;
  scene.add(ground);
}

function createVoronoiFracture(geometry, numberOfPieces, scale = 0.5, maxSize = 1) {
  const positions = geometry.attributes.position.array;
  const points = [];
  for (let i = 0; i < positions.length; i += 3) {
    points.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
  }

  const voronoiPoints = [];
  for (let i = 0; i < numberOfPieces; i++) {
    voronoiPoints.push(points[Math.floor(Math.random() * points.length)]);
  }

  const pieces = [];
  for (let i = 0; i < numberOfPieces; i++) {
    const pieceGeometry = new THREE.ConvexGeometry(voronoiPoints);
    
    // Scale down the geometry
    pieceGeometry.scale(scale, scale, scale);
    
    // Center the geometry
    pieceGeometry.computeBoundingSphere();
    const center = pieceGeometry.boundingSphere.center;
    pieceGeometry.translate(-center.x, -center.y, -center.z);
    
    // Limit the size of the piece
    const boundingBox = new THREE.Box3().setFromBufferAttribute(pieceGeometry.attributes.position);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    
    const maxDimension = Math.max(size.x, size.y, size.z);
    if (maxDimension > maxSize) {
      const scaleFactor = maxSize / maxDimension;
      pieceGeometry.scale(scaleFactor, scaleFactor, scaleFactor);
    }
    
    pieces.push(pieceGeometry);
  }

  return pieces;
}

function setupPlayer() {
  if (!playerModel) {
    console.error("Player model not loaded yet");
    return;
  }
  

  const scale = 50; // Adjust this value to fit your scene
  playerModel.scale.set(scale, scale, scale);
  playerModel.position.set(0, -0.5, lanes[currentLane]);
  
  
  playerModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  

  scene.add(playerModel);
  player = playerModel; // Set the player variable to the model for consistency
}
  

// Section 4: Obstacles
let nextObstacleId = 0;
let obstaclesToRemove = [];

function spawnObstacle() {
  if (!gameStarted) return;
  const obstacleType = Math.random();
  
  if (obstacleType < 0.33) {
    spawnRock();
  } else if (obstacleType < 0.67) {
    spawnBox();
  } else {
    spawnBlockade();
  }

  const percent = currentspeed / initialCurrentSpeed;
  setTimeout(spawnObstacle, (Math.random() * 200) / percent + 1000 / percent);
  console.log("Current speed " + currentspeed);
}

function spawnBlockade() {
  if (!cachedBlockadeModel) {
    console.error("Blockade model not loaded yet");
    return;
  }

  const blockade = cachedBlockadeModel.clone();

  const scale = 0.01; // Adjust this value to fit your scene
  blockade.scale.set(scale, scale, scale);

  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  blockade.position.set(30, -0.5, lane);

    // Add random rotation
    //blockade.rotation.x = Math.random() * Math.PI * 2;
    blockade.rotation.y = Math.random() * Math.PI * 2;

  blockade.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  blockade.userData.id = nextObstacleId++;
  scene.add(blockade);
  obstacles.push(blockade);
}

function spawnRock() {
  if (!cachedRockTexture || !cachedRockGeometry) {
    console.error("Assets not loaded yet");
    return;
  }

  const material = new THREE.MeshStandardMaterial({
    map: cachedRockTexture,
  });

  const rock = new THREE.Mesh(cachedRockGeometry, material);

  const scale = 0.5;
  rock.scale.set(scale, scale, scale);

  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  rock.position.set(30, 0, lane);

  rock.rotation.x = Math.random() * Math.PI * 2;
  rock.rotation.y = Math.random() * Math.PI * 2;
  rock.rotation.z = Math.random() * Math.PI * 2;

  rock.castShadow = true;
  rock.receiveShadow = true;

  rock.userData.id = nextObstacleId++;
  scene.add(rock);
  obstacles.push(rock);
}

// Usag
function spawnBox() {
  const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
  const obstacleMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.3,
    roughness: 0.4,
    metalness: 0.6,
  });
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  const lane = lanes[Math.floor(Math.random() * lanes.length)];
  obstacle.position.set(30, 0, lane);
  obstacle.castShadow = true;
  obstacle.receiveShadow = true;
  obstacle.userData.id = nextObstacleId++;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

// Section 5: Game Logic and Animation
let musicStarted = false;

function onKeyDown(event) {
  if (event.key === " ") {
    if (!isJumping) {
      isJumping = true;
      jumpStartTime = Date.now();
      transitionToJumpAnimation(); // Add this line
      playJumpSound();
    }
  } else if (event.key === "d" && currentLane > 0 && !isSwitchingLane) {
    
    isSwitchingLane = true;
    switchStartTime = Date.now();
    startLane = player.position.z; // Use actual position instead of lanes[currentLane]
    targetLane = lanes[--currentLane];
  } else if (
    event.key === "a" &&
    currentLane < lanes.length - 1 &&
    !isSwitchingLane
  ) {

    isSwitchingLane = true;
    switchStartTime = Date.now();
    startLane = player.position.z;
    targetLane = lanes[++currentLane];  
  }
}

let waveAnimation = 0;
const waveSpeed = 0.03;
const maxRotation = 10 * (Math.PI / 180); // 10 degrees in radians
const zOffset = 0.2; // How much to offset the z position
let playerTargetRotation = 0;
let playerCurrentRotation = 0;
const playerRotationSpeed = 0.1; // Adjust this to control rotation speed
const playerMaxRotation = 30 * (Math.PI / 180); // 15 degrees in radians

function transitionToJumpAnimation() {
  const idleAnimation = playeranimations.find(anim => anim.name === "Idle_2_Victory");
  const jumpAnimation = playeranimations.find(anim => anim.name === "Victory");

  if (idleAnimation && jumpAnimation) {
    const idleAction = mixer.clipAction(idleAnimation);
    const jumpAction = mixer.clipAction(jumpAnimation);

    // Smoothly transition from idle to jump
    idleAction.fadeOut(0.15);
    jumpAction.reset();
    jumpAction.fadeIn(0.15);

    // Set the jump animation to play 2x faster
    jumpAction.timeScale = 2;

    jumpAction.play();

    // Set the jump animation to play once and then transition back to idle
    jumpAction.loop = THREE.LoopOnce;
    jumpAction.clampWhenFinished = true;

    const jumpDurationSeconds = jumpAnimation.duration / 2; 

    // Use setTimeout to transition back to idle
    setTimeout(() => {
      jumpAction.fadeOut(0.15);
      idleAction.reset();
      idleAction.fadeIn(0.15);
      idleAction.play();
    }, jumpDurationSeconds * 1000); // Convert to milliseconds
  } else {
    console.warn("No anim found :/");
  }
}

function cubicBezier(t, p0, p1, p2, p3) {
  const ct = 1 - t;
  return ct * ct * ct * p0 + 
         3 * ct * ct * t * p1 + 
         3 * ct * t * t * p2 + 
         t * t * t * p3;
}

function animate() {
  requestAnimationFrame(animate);
  const now = Date.now();

  if (mixer) {
    mixer.update(1/60);
  }

  
  waveAnimation += waveSpeed;

  if (gameStarted) {
    updateScoreAndTime();
    const rotationY = Math.sin(waveAnimation) * maxRotation;
    const zPositionOffset = Math.sin(waveAnimation) * zOffset;
  
    // Apply rotation
    if (player) {
      player.rotation.y = rotationY;
      player.position.z = lanes[currentLane] + zPositionOffset;
    }
    waveAnimation += waveSpeed;
    const waveRotationY = Math.sin(waveAnimation) * maxRotation;

    // Lane switching animation
    if (isSwitchingLane) {
        const elapsed = now - switchStartTime;
        if (elapsed < laneSwitchDuration) {
            const progress = elapsed / laneSwitchDuration;
            
            const bezierZ = cubicBezier(
                progress,
                startLane,
                startLane + (targetLane - startLane) * 0.25,
                startLane + (targetLane - startLane) * 0.75,
                targetLane
            );
            
            player.position.z = bezierZ + Math.sin(waveAnimation) * zOffset;

            playerTargetRotation = (targetLane > startLane) ? -playerMaxRotation : playerMaxRotation;

            // Smoothly interpolate current rotation towards target rotation
            playerCurrentRotation += (playerTargetRotation - playerCurrentRotation) * playerRotationSpeed;
        } else {
            player.position.z = targetLane + Math.sin(waveAnimation) * zOffset;
            isSwitchingLane = false;

            // Loop to back to 0 again hehe
            playerTargetRotation = 0;
        }
    } else {
        // When not switching lanes, continue to smoothly rotate back to neutral
        playerCurrentRotation += (playerTargetRotation - playerCurrentRotation) * playerRotationSpeed;
    }

    // Apply combined rotation to player
    player.rotation.y = waveRotationY + playerCurrentRotation;
    if (currentspeed <= 0.3) {
      currentspeed += 0.0001;
    }
  }

  // Calculate rotation and position offset


  // Player jump animation
  if (isJumping) {
    const elapsed = now - jumpStartTime;
    if (elapsed < jumpDuration) {
      const progress = elapsed / jumpDuration;
      const height = Math.sin(progress * Math.PI) * jumpHeight;
      player.position.y = height;
      
      cameraTargetY = cameraBaseY + height * 0.5; // Ini buat define target ketinggian kamera sebenarnya
    } else {
      player.position.y = -0.5;
      isJumping = false;
      cameraTargetY = cameraBaseY; // Reset camera target when jump is finished
    }
  } else {
    cameraTargetY = cameraBaseY; // Ensure camera returns to base position when not jumping
  }

  // Lerp the camera's Y position
  cameraCurrentY += (cameraTargetY - cameraCurrentY) * cameraLerpFactor;

  // Update camera position
  camera.position.y = cameraCurrentY;

  // Lane switching animation
  /*
  if (isSwitchingLane) {
    const elapsed = now - switchStartTime;
    if (elapsed < laneSwitchDuration) {
      const progress = elapsed / laneSwitchDuration;
      const newZ = startLane + (targetLane - startLane) * progress;
      player.position.z = newZ + Math.sin(waveAnimation) * zOffset;
    } else {
      player.position.z = targetLane + Math.sin(waveAnimation) * zOffset;
      isSwitchingLane = false;
    }
  }
    */

  // Obstacle movement
  obstacles.forEach((obstacle, index) => {
    obstacle.position.x -= currentspeed;
    if (obstacle.position.x < -100) {
      obstaclesToRemove.push(obstacle.userData.id);
    }
  });

  // Collision detection
  obstacles.forEach((obstacle) => {
    const playerBox = new THREE.Box3().setFromObject(player);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);

    if (playerBox.intersectsBox(obstacleBox)) {
      console.log("Hit obstacle!");
      playObstacleHitSound(); // Use the sound pool function
      score = Math.max(0, score - 20); // Decrease score by 20, but not below 0
      document.getElementById('scoreValue').textContent = score;
      explodeObstacle(obstacle);
    }
  });

  // Remove marked obstacles
  removeMarkedObstacles();

  // Camera wiggle effect
  const wiggleAmount = 0.42;
  camera.position.x = 10 + Math.sin(now * 0.001) * wiggleAmount;
  camera.position.z = 10 + Math.cos(now * 0.001) * wiggleAmount;

  composer.render();
}

function explodeObstacle(obstacle) {
  let geometries = [];

  // Check if the obstacle is a complex model (like FBX)
  if (obstacle.isGroup || obstacle.type === 'Object3D') {
    obstacle.traverse((child) => {
      if (child.isMesh && child.geometry) {
        geometries.push(child.geometry);
      }
    });
  } else if (obstacle.geometry) {
    // For simple obstacles with a single geometry
    geometries.push(obstacle.geometry);
  }

  if (geometries.length === 0) {
    console.error("No geometries found in the obstacle");
    return;
  }

  const explosionGroup = new THREE.Group();

  // Calculate the maximum size based on the obstacle's bounding box
  const boundingBox = new THREE.Box3().setFromObject(obstacle);
  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  const maxSize = Math.min(size.x, size.y, size.z) * 0.3; // Limit to 30% of the smallest dimension

  geometries.forEach((geometry) => {
    const explosionPieces = createVoronoiFracture(geometry, 5, 0.3, maxSize); // Add maxSize parameter

    explosionPieces.forEach((pieceGeometry) => {
      const pieceMaterial = obstacle.material ? obstacle.material.clone() : new THREE.MeshPhongMaterial({ color: 0xcccccc });
      const pieceMesh = new THREE.Mesh(pieceGeometry, pieceMaterial);
      
      // Position the piece randomly within the obstacle's bounding box
      pieceMesh.position.set(
        obstacle.position.x + (Math.random() - 0.5) * size.x * 0.8,
        obstacle.position.y + (Math.random() - 0.5) * size.y * 0.8,
        obstacle.position.z + (Math.random() - 0.5) * size.z * 0.8
      );
      
      // Add random velocity to each piece
      pieceMesh.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        Math.random() * 0.2,
        (Math.random() - 0.5) * 0.2
      );
      
      explosionGroup.add(pieceMesh);
    });
  });

  scene.add(explosionGroup);
  scene.remove(obstacle);
  obstacles = obstacles.filter(obj => obj !== obstacle);

  // Animate the explosion (same as before)
  function animateExplosion() {
    explosionGroup.children.forEach((piece) => {
      piece.position.add(piece.userData.velocity);
      piece.userData.velocity.y -= 0.005;
      piece.rotation.x += 0.02;
      piece.rotation.y += 0.02;
      piece.rotation.z += 0.02;
    });

    if (explosionGroup.children[0].position.y > -5) {
      requestAnimationFrame(animateExplosion);
    } else {
      scene.remove(explosionGroup);
    }
  }

  animateExplosion();
}
// Section 6: Post-processing
function setupPostProcessing() {
  composer = new THREE.EffectComposer(renderer);

  const renderPass = new THREE.RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3, // Strength
    0.9, // Radius
    0.45 // Threshold
  );
  composer.addPass(bloomPass);

  const saoPass = new THREE.SAOPass(scene, camera, false, true);
  saoPass.params.output = THREE.SAOPass.OUTPUT.Default;
  saoPass.params.saoBias = 0.5;
  saoPass.params.saoIntensity = 0.12;
  saoPass.params.saoScale = 100;
  saoPass.params.saoKernelRadius = 100;
  saoPass.params.saoMinResolution = 0;
  saoPass.params.saoBlur = true;
  saoPass.params.saoBlurRadius = 4;
  saoPass.params.saoBlurStdDev = 16;
  saoPass.params.saoBlurDepthCutoff = 0.01;

  composer.addPass(saoPass);
  //addSAOGUI(saoPass);
}

// Section 7: Utility Functions
function removeMarkedObstacles() {
  if (obstaclesToRemove.length > 0) {
    obstacles = obstacles.filter((obstacle) => {
      if (obstaclesToRemove.includes(obstacle.userData.id)) {
        scene.remove(obstacle);
        return false;
      }
      return true;
    });
    obstaclesToRemove = [];
  }
}

createLoadingScene();


// With:
preloadAssets(function () {
  console.log("Assets loaded, ready to start the game");
  init();
});