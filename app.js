
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const video = document.querySelector("#webcam");
const canvas = document.querySelector("#overlay");
const ctx = canvas.getContext("2d");

const startBtn = document.querySelector("#startBtn");
const stopBtn = document.querySelector("#stopBtn");
const placeholder = document.querySelector("#placeholder");

const statusBadge = document.querySelector("#statusBadge");
const feedbackIcon = document.querySelector("#feedbackIcon");
const feedbackTitle = document.querySelector("#feedbackTitle");
const feedbackText = document.querySelector("#feedbackText");

const handsCount = document.querySelector("#handsCount");
const gestureResult = document.querySelector("#gestureResult");

// ------------------------------
// AR REFERENCE IMAGES
// ------------------------------

const signImages = {
  A: new Image(),
  B: new Image(),
  C: new Image()
};

signImages.A.src = "/images/img_A.png";
signImages.B.src = "/images/img_B.png";
signImages.C.src = "/images/img_C.png";

let currentSign = "C";
let showARGuide = true;
let guideOpacity = 0.4;

const signGuide = document.querySelector("#signGuide");

function updateSignGuide() {
  signGuide.src = signImages[currentSign].src;
  signGuide.alt = `ISL letter ${currentSign} reference`;
  signGuide.style.opacity = showARGuide
    ? String(guideOpacity)
    : "0";
}

// ------------------------------
// WELCOME PAGE, LEVELS, AND PRACTICE NAVIGATION
// ------------------------------

const welcomeScreen = document.querySelector("#welcomeScreen");
const practiceScreen = document.querySelector("#practiceScreen");
const backBtn = document.querySelector("#backBtn");
const welcomeButtons = document.querySelectorAll(".level-btn");
const completionMessage = document.querySelector("#completionMessage");

const completedLetters = new Set(); // Progress resets when the page is refreshed.
let completedThisPractice = false;

function refreshLevelButtons() {
  welcomeButtons.forEach((button) => {
    const letter = button.dataset.sign;
    const isCompleted = completedLetters.has(letter);
    const isUnlocked =
      letter === "A" ||
      (letter === "B" && completedLetters.has("A")) ||
      (letter === "C" && completedLetters.has("B"));

    button.disabled = !isUnlocked;
    button.classList.toggle("completed", isCompleted);
    button.classList.toggle("locked", !isUnlocked);
    button.textContent = isCompleted ? `${letter} ✓` : letter;
    button.setAttribute(
      "aria-label",
      isCompleted ? `Letter ${letter}, completed` :
      !isUnlocked ? `Letter ${letter}, locked` : `Practise letter ${letter}`
    );
  });
}

function openPractice(letter) {
  currentSign = letter;
  document.querySelector("#practiceLetter").textContent = letter;
  completedThisPractice = false;
  completionMessage.hidden = true;
  welcomeScreen.hidden = true;
  practiceScreen.hidden = false;

  updateSignGuide();

  const guideLabel = document.querySelector(".ar-guide-label");
  if (guideLabel) {
    guideLabel.textContent = `AR GUIDE · TARGET LETTER ${currentSign}`;
  }

  gestureResult.textContent = "Waiting";
  setFeedback(
    `Practise letter ${currentSign}`,
    currentSign === "B"
      ? "Match the reference using both hands."
      : "Show one hand clearly and match the reference image.",
    "✋"
  );

  startCamera();
}

function returnToWelcome() {
  stopCamera();
  practiceScreen.hidden = true;
  welcomeScreen.hidden = false;
  completionMessage.hidden = true;
  refreshLevelButtons();
}

welcomeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.disabled) openPractice(button.dataset.sign);
  });
});

backBtn.addEventListener("click", returnToWelcome);

function completeCurrentLetter() {
  if (completedThisPractice || completedLetters.has(currentSign)) return;

  completedThisPractice = true;
  completedLetters.add(currentSign);
  refreshLevelButtons();

  const nextLetter = currentSign === "A" ? "B" :
    currentSign === "B" ? "C" : null;

  completionMessage.hidden = false;
  completionMessage.textContent = nextLetter
    ? `🎉 Congratulations! Letter ${currentSign} completed. Go back and try letter ${nextLetter} next!`
    : "🎉 Congratulations! You completed letters A, B, and C!";

  setFeedback(
    `Letter ${currentSign} completed!`,
    nextLetter
      ? `Great job! Letter ${nextLetter} is now unlocked. Click Back to return to the welcome page.`
      : "Great job! You have finished all three practice letters.",
    "🎉"
  );
}

// ------------------------------
// CAMERA AND TRACKING VARIABLES
// ------------------------------

let stream = null;
let landmarker = null;
let running = false;
let lastVideoTime = -1;
let lastCheckAt = 0;

const connections = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

// ------------------------------
// STATUS AND FEEDBACK
// ------------------------------

function setStatus(text, kind = "neutral") {
  statusBadge.textContent = text;
  statusBadge.className = `badge ${kind}`;
}

function setFeedback(title, text, icon = "◎") {
  feedbackTitle.textContent = title;
  feedbackText.textContent = text;
  feedbackIcon.textContent = icon;
}

// ------------------------------
// LOAD MEDIAPIPE HAND TRACKER
// ------------------------------

async function createLandmarker() {
  setFeedback(
    "Loading hand tracker…",
    "Loading the hand-tracking model.",
    "…"
  );

  const vision = await FilesetResolver.forVisionTasks("/wasm");

  const response = await fetch(
    "/models/hand_landmarker_fixed.task"
  );

  if (!response.ok) {
    throw new Error(
      `Model download failed: ${response.status}`
    );
  }

  const modelBuffer = await response.arrayBuffer();

  return await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetBuffer: new Uint8Array(modelBuffer),
      delegate: "CPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });
}

// ------------------------------
// START CAMERA
// ------------------------------

async function startCamera() {
  startBtn.disabled = true;

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        "Camera access is unavailable. Open this site through localhost or HTTPS."
      );
    }

    if (!landmarker) {
      landmarker = await createLandmarker();
    }

    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });

    video.srcObject = stream;

    await video.play();

    running = true;
    lastVideoTime = -1;

    placeholder.hidden = true;
    stopBtn.disabled = false;

    setStatus("Camera on", "good");

    setFeedback(
      "Show your hand",
      "Keep your hand inside the frame. Green lines will follow detected hands.",
      "✋"
    );

    resizeCanvas();

    requestAnimationFrame(processFrame);

  } catch (error) {
    console.error(error);

    startBtn.disabled = false;

    setStatus("Could not start", "warn");

    setFeedback(
      "Could not start camera",
      error.message || "Check the browser Console for the exact error.",
      "!"
    );
  }
}

// ------------------------------
// STOP CAMERA
// ------------------------------

function stopCamera() {
  running = false;

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  stream = null;
  video.srcObject = null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  placeholder.hidden = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  handsCount.textContent = "0";
  gestureResult.textContent = "Waiting";

  setStatus("Camera off", "neutral");

  setFeedback(
    "Camera stopped",
    "Start the camera whenever you're ready to practise.",
    "◎"
  );
}

// ------------------------------
// CANVAS SIZE
// ------------------------------

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// ------------------------------
// DRAW HAND LANDMARKS
// ------------------------------

function drawHand(landmarks, width, height) {
  const points = landmarks.map((point) => ({
    x: (1 - point.x) * width,
    y: point.y * height
  }));

  ctx.lineWidth = 3;
  ctx.strokeStyle = "#68e6c2";
  ctx.fillStyle = "#ffffff";
  ctx.lineCap = "round";

  for (const [a, b] of connections) {
    ctx.beginPath();
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
    ctx.stroke();
  }

  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#087e8b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ------------------------------
// GEOMETRY HELPERS
// ------------------------------

function getDistance(landmarks, a, b) {
  return Math.hypot(
    landmarks[a].x - landmarks[b].x,
    landmarks[a].y - landmarks[b].y
  );
}

function getAngle(landmarks, a, b, c) {
  const ba = {
    x: landmarks[a].x - landmarks[b].x,
    y: landmarks[a].y - landmarks[b].y
  };

  const bc = {
    x: landmarks[c].x - landmarks[b].x,
    y: landmarks[c].y - landmarks[b].y
  };

  const dot = ba.x * bc.x + ba.y * bc.y;

  const magBA = Math.hypot(ba.x, ba.y);
  const magBC = Math.hypot(bc.x, bc.y);

  if (magBA === 0 || magBC === 0) {
    return 180;
  }

  const cosine = Math.max(
    -1,
    Math.min(1, dot / (magBA * magBC))
  );

  return Math.acos(cosine) * (180 / Math.PI);
}

// ------------------------------
// LETTER A RECOGNITION
// Initial geometric heuristic
// ------------------------------

function checkLetterA(landmarks) {
  const palmSize = getDistance(landmarks, 0, 9);

  if (palmSize < 0.001) {
    return false;
  }

  const curledDistances = [
    getDistance(landmarks, 8, 6) / palmSize,
    getDistance(landmarks, 12, 10) / palmSize,
    getDistance(landmarks, 16, 14) / palmSize,
    getDistance(landmarks, 20, 18) / palmSize
  ];

  const curledFingers = curledDistances.filter(
    (distance) => distance >= 0.08 && distance <= 0.38
  ).length;

  const thumbGap =
    getDistance(landmarks, 4, 5) / palmSize;

  const indexAngle = getAngle(
    landmarks,
    5,
    6,
    8
  );

  const thumbOK =
    thumbGap >= 0.18 &&
    thumbGap <= 0.65;

  const indexOK =
    indexAngle >= 65 &&
    indexAngle <= 155;

  return curledFingers >= 3 && thumbOK && indexOK;
}

// ------------------------------
// LETTER B RECOGNITION
// Initial geometric heuristic
// ------------------------------

function checkLetterB(hands) {
  // The target shape requires two hands.
  if (!hands || hands.length !== 2) {
    return false;
  }

  const hand1 = hands[0];
  const hand2 = hands[1];

  // Estimate the size of each palm.
  const palm1 = getDistance(hand1, 0, 9);
  const palm2 = getDistance(hand2, 0, 9);

  if (palm1 < 0.001 || palm2 < 0.001) {
    return false;
  }

  // Calculate the average palm size for scale-independent checks.
  const averagePalm = (palm1 + palm2) / 2;

  // Distance between the two index fingertips.
  const indexGap = getDistanceBetweenPoints(
    hand1[8],
    hand2[8]
  ) / averagePalm;

  // Distance between the two thumb tips.
  const thumbGap = getDistanceBetweenPoints(
    hand1[4],
    hand2[4]
  ) / averagePalm;

  // Both pairs of fingertips should meet near the centre.
  const indexTipsMeet = indexGap < 0.35;
  const thumbTipsMeet = thumbGap < 0.35;

  return indexTipsMeet && thumbTipsMeet;
}

function getDistanceBetweenPoints(point1, point2) {
  return Math.hypot(
    point1.x - point2.x,
    point1.y - point2.y
  );
}



// ------------------------------
// LETTER C RECOGNITION
// Initial geometric heuristic
// ------------------------------

function checkLetterC(landmarks) {
  const palmSize = getDistance(landmarks, 0, 9);

  if (palmSize < 0.001) {
    return false;
  }

  const gap =
    getDistance(landmarks, 4, 8) / palmSize;

  const thumbPosition =
    getDistance(landmarks, 4, 5) / palmSize;

  const angles = [
    getAngle(landmarks, 5, 6, 8),
    getAngle(landmarks, 9, 10, 12),
    getAngle(landmarks, 13, 14, 16),
    getAngle(landmarks, 17, 18, 20)
  ];

  const curvedFingers = angles.filter(
    (angle) => angle >= 110 && angle <= 165
  ).length;

  const gapOK =
    gap >= 0.35 &&
    gap <= 0.85;

  const thumbOK =
    thumbPosition >= 0.20 &&
    thumbPosition <= 0.65;

  return gapOK && thumbOK && curvedFingers >= 2;
}

// ------------------------------
// SELECTED SIGN CHECKER
// ------------------------------

function checkSelectedSign(hands) {
  if (currentSign === "A") {
    return hands.length > 0 && checkLetterA(hands[0]);
  }

  if (currentSign === "B") {
    return checkLetterB(hands);
  }

  if (currentSign === "C") {
    return hands.length > 0 && checkLetterC(hands[0]);
  }

  return false;
}



// ------------------------------
// RECOGNITION FEEDBACK
// ------------------------------

function showSignFeedback(isCorrect) {
  if (isCorrect) {
    gestureResult.textContent = `${currentSign} detected`;

    setFeedback(
      `Possible ${currentSign} shape detected`,
      `Your hand measurements fall within the current ${currentSign}-shape ranges. This is an experimental check, not verified ISL recognition.`,
      "✓"
    );

  } else {
    gestureResult.textContent = "Try again";

    const instructions = {
      A: "Curl your fingers and adjust your thumb to match the A reference.",
      B: "Extend your fingers and bring your thumb closer to your palm to match the B reference.",
      C: "Adjust your thumb and fingers to match the C reference."
    };

    setFeedback(
      `${currentSign} shape not detected`,
      instructions[currentSign],
      "↻"
    );
  }
}

// ------------------------------
// MAIN AR FRAME LOOP
// ------------------------------

function processFrame() {
  if (!running || video.readyState < 2) {
    if (running) {
      requestAnimationFrame(processFrame);
    }

    return;
  }

  const rect = canvas.getBoundingClientRect();

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  if (video.currentTime !== lastVideoTime) {
    const result = landmarker.detectForVideo(
      video,
      performance.now()
    );

    lastVideoTime = video.currentTime;

    const hands = result.landmarks || [];

    handsCount.textContent = String(hands.length);

    // Draw every detected hand.
    for (const hand of hands) {
      drawHand(hand, width, height);
    }

    if (hands.length > 0) {
      // Check the first detected hand.
      // Both detected hands are drawn, but recognition uses one hand.
      if (performance.now() - lastCheckAt > 250) {
        lastCheckAt = performance.now();

        const isCorrect = checkSelectedSign(hands);

        if (isCorrect) {
          completeCurrentLetter();
        }

        if (!completedThisPractice) {
          showSignFeedback(isCorrect);
        }
      }

      setStatus("Hand detected", "good");

    } else {
      gestureResult.textContent = "No hand";

      if (!completedThisPractice) {
        setFeedback(
          "No hand detected",
          "Move your hand fully into the frame or improve the lighting.",
          "…"
        );
      }

      setStatus("Looking for hand", "warn");
    }
  }

  requestAnimationFrame(processFrame);
}

// ------------------------------
// EVENT LISTENERS
// ------------------------------

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

window.addEventListener("resize", resizeCanvas);

window.addEventListener("beforeunload", () => {
  stream?.getTracks().forEach((track) => track.stop());
});

// ------------------------------
// INITIAL PAGE STATE
// ------------------------------

updateSignGuide();
refreshLevelButtons();

setStatus("Camera off", "neutral");
stopBtn.disabled = true;
