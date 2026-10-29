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
const gestureReferenceImage = document.querySelector("#gestureReferenceImage");
const gestureInstructionTitle = document.querySelector("#gestureInstructionTitle");
const gestureInstructionSteps = document.querySelector("#gestureInstructionSteps");
const gestureInstructionTip = document.querySelector("#gestureInstructionTip");

// These instructions describe the supplied project reference images. Confirm them
// with an ISL instructor before presenting the app as an authoritative ISL course.
const gestureGuides = {
  A: {
    alt: "Two closed fists with the thumbs meeting at the top",
    steps: ["Make a fist with each hand.", "Bring the thumbs toward each other until their tips meet.", "Keep the other fingers folded and compare with the reference image."],
    tip: "Tip: Keep both fists level and bring only the thumb tips together."
  },
  B: {
    alt: "Both hands curved into small circles with thumb and index fingertips meeting near the centre",
    steps: ["Curve the thumb and index finger of each hand toward each other.", "Bring each thumb tip and index fingertip together to form a small loop.", "Curve the remaining fingers naturally and bring both hands together as shown."],
    tip: "Tip: The supplied B reference shows two pinching/loop shapes meeting in the middle."
  },
  C: {
    alt: "One hand curved into a C shape with space between the thumb and fingers",
    steps: ["Use one hand and curve the fingers together into a rounded arc.", "Move the thumb away from the fingers, leaving a clear C-shaped gap.", "Keep the palm turned sideways enough for the C shape to be visible."],
    tip: "Tip: Keep the gap open; do not let the thumb touch the fingertips."
  }
};

function updateGestureInstructions() {
  const guide = gestureGuides[currentSign];
  if (!guide) return;
  if (gestureReferenceImage) {
    gestureReferenceImage.src = signImages[currentSign].src;
    gestureReferenceImage.alt = `Reference for letter ${currentSign}: ${guide.alt}`;
  }
  if (gestureInstructionTitle) gestureInstructionTitle.textContent = `Letter ${currentSign}`;
  if (gestureInstructionSteps) {
    gestureInstructionSteps.replaceChildren(...guide.steps.map((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      return li;
    }));
  }
  if (gestureInstructionTip) gestureInstructionTip.textContent = guide.tip;
}

function updateSignGuide() {
  signGuide.src = signImages[currentSign].src;
  signGuide.alt = `ISL letter ${currentSign} reference`;
  signGuide.style.opacity = showARGuide
    ? String(guideOpacity)
    : "0";
  updateGestureInstructions();
}

// ------------------------------
// WELCOME PAGE, LEVELS, AND PRACTICE NAVIGATION
// ------------------------------

const welcomeScreen = document.querySelector("#welcomeScreen");
const practiceScreen = document.querySelector("#practiceScreen");
const backBtn = document.querySelector("#backBtn");
const welcomeButtons = document.querySelectorAll(".level-btn");
const completionMessage = document.querySelector("#completionMessage");
const nextLevelBtn = document.querySelector("#nextLevelBtn");
const starAward = document.querySelector("#starAward");
const progressText = document.querySelector("#progressText");
const progressFill = document.querySelector("#progressFill");
const totalStars = document.querySelector("#totalStars");
const celebrationOverlay = document.querySelector("#celebrationOverlay");
const celebrationParticles = document.querySelector("#celebrationParticles");
const celebrationTitle = document.querySelector("#celebrationTitle");
const celebrationSubtitle = document.querySelector("#celebrationSubtitle");
let celebrationTimer = null;

function showCelebration(letter, nextLetter) {
  if (celebrationTimer) clearTimeout(celebrationTimer);
  celebrationParticles.replaceChildren();

  celebrationTitle.textContent = nextLetter
    ? `🎉 Letter ${letter} completed! 🎉`
    : "🏆 You completed all three letters! 🏆";
  celebrationSubtitle.textContent = nextLetter
    ? `Amazing work! Letter ${nextLetter} is unlocked.`
    : "Amazing work! You finished A, B, and C!";

  const symbols = ["✨", "⭐", "🌟", "🎉", "💖", "✦", "✧", "🎊"];
  for (let i = 0; i < 100; i++) {
    const particle = document.createElement("span");
    particle.className = "celebration-particle";
    particle.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    particle.style.setProperty("--x", `${Math.random() * 100}%`);
    particle.style.setProperty("--size", `${14 + Math.random() * 22}px`);
    particle.style.setProperty("--duration", `${2.2 + Math.random() * 2.2}s`);
    particle.style.setProperty("--delay", `${Math.random() * 0.9}s`);
    particle.style.setProperty("--drift", `${-100 + Math.random() * 200}px`);
    celebrationParticles.appendChild(particle);
  }

  celebrationOverlay.hidden = false;
  celebrationOverlay.setAttribute("aria-hidden", "false");
}

const completedLetters = new Set(); // Progress resets when the page is refreshed.
const pointsByLetter = { A: 0, B: 0, C: 0 };
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
    const letterLabel = button.querySelector(".level-letter");
    const caption = button.querySelector(".level-caption");
    if (letterLabel) letterLabel.textContent = isCompleted ? `${letter} ✓` : letter;
    if (caption) caption.textContent = isCompleted ? "Completed" : (isUnlocked ? `Level ${letter === "A" ? 1 : letter === "B" ? 2 : 3}` : `🔒 Level ${letter === "B" ? 2 : 3}`);
    const stars = button.querySelector(`[data-stars="${letter}"]`);
    if (stars) stars.textContent = completedLetters.has(letter) ? "★ +1 point" : "☆ Not completed";
    button.setAttribute("aria-label", isCompleted ? `Letter ${letter}, completed, one point earned` : !isUnlocked ? `Letter ${letter}, locked` : `Practise letter ${letter}`);
  });
  const count = completedLetters.size;
  if (progressText) progressText.textContent = `${count} / 3 levels complete`;
  if (progressFill) progressFill.style.width = `${count / 3 * 100}%`;
  const earned = completedLetters.size;
  if (totalStars) totalStars.textContent = `⭐ Score: ${earned}/3 points`;
}

function openPractice(letter) {
  if (celebrationTimer) clearTimeout(celebrationTimer);
  celebrationTimer = null;
  celebrationOverlay.hidden = true;
  celebrationOverlay.setAttribute("aria-hidden", "true");
  celebrationParticles.replaceChildren();
  currentSign = letter;
  document.querySelector("#practiceLetter").textContent = letter;
  completedThisPractice = false;
  completionMessage.hidden = true;
  starAward.hidden = true;
  nextLevelBtn.hidden = true;
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
  if (celebrationTimer) clearTimeout(celebrationTimer);
  celebrationTimer = null;
  celebrationOverlay.hidden = true;
  celebrationOverlay.setAttribute("aria-hidden", "true");
  celebrationParticles.replaceChildren();
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
nextLevelBtn.addEventListener("click", () => {
  const nextLetter = currentSign === "A" ? "B" : currentSign === "B" ? "C" : null;
  if (nextLetter) openPractice(nextLetter);
  else returnToWelcome();
});

function completeCurrentLetter() {
  if (completedThisPractice || completedLetters.has(currentSign)) return;

  completedThisPractice = true;
  completedLetters.add(currentSign);
  pointsByLetter[currentSign] = 1;
  refreshLevelButtons();

  const nextLetter = currentSign === "A" ? "B" : currentSign === "B" ? "C" : null;
  const score = completedLetters.size;
  completionMessage.hidden = false;
  completionMessage.textContent = nextLetter
    ? `🎉 Letter ${currentSign} completed! Letter ${nextLetter} is unlocked.`
    : "🏆 Amazing! You completed all three letters!";
  starAward.hidden = false;
  starAward.innerHTML = `<div class="star-award-title">+1 POINT</div><div class="earned-stars">⭐</div><div class="star-award-note">Your score: ${score}/3 points</div>`;
  nextLevelBtn.hidden = false;
  nextLevelBtn.textContent = nextLetter ? `Next Level: ${nextLetter} →` : "Finish Journey ✓";

  showCelebration(currentSign, nextLetter);
  // Put the score and navigation inside the celebration popup.
  const popupScore = document.querySelector("#celebrationScore");
  if (popupScore) popupScore.textContent = `⭐ +1 POINT · YOUR SCORE: ${score}/3`;
  nextLevelBtn.hidden = false;
  setFeedback(
    `Letter ${currentSign} completed!`,
    nextLetter ? `Great job! Letter ${nextLetter} is unlocked. Click Next Level to continue.` : "Great job! You have finished all three practice letters.",
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
let correctSince = 0;
const HOLD_DURATION_MS = 2500; // Gesture must remain correct for 2.5 continuous seconds.

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
  correctSince = 0;

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
          // Only accept a gesture if it stays correct continuously for 2.5 seconds.
          const now = performance.now();
          if (correctSince === 0) correctSince = now;
          const heldFor = now - correctSince;
          const remaining = Math.max(0, (HOLD_DURATION_MS - heldFor) / 1000);

          if (heldFor >= HOLD_DURATION_MS) {
            completeCurrentLetter();
          } else if (!completedThisPractice) {
            gestureResult.textContent = `Hold still: ${remaining.toFixed(1)}s`;
            setFeedback(
              `Letter ${currentSign} — keep holding`,
              `The gesture looks like ${currentSign}. Keep the same hand position steady for ${remaining.toFixed(1)} more seconds (2.5 seconds total).`,
              "⏱"
            );
          }
        } else {
          // Any mismatch resets the timer; the whole hold must be continuous.
          correctSince = 0;
          if (!completedThisPractice) showSignFeedback(false);
        }
      }

      setStatus("Hand detected", "good");

    } else {
      correctSince = 0;
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
