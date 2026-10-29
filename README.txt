SignSteps AR · Prototype · ProgressSignSteps AR — visual refresh

What changed (look & feel only):
- index.html : same structure and element IDs, plus decorative hero shapes, fonts, favicon.
               Feedback box moved under the camera buttons for a more balanced layout.
- style.css  : fully redesigned (bold violet hero, chunky game-style buttons and level tiles,
               animated progress bar, glowing camera frame when a hand is detected,
               bouncier celebration popup, responsive + reduced-motion support).
- app.js     : UNCHANGED (byte-for-byte identical) - all tracking, 2.5s hold, level logic intact.

Setup (same as before):
  npm install        (also copies the MediaPipe WASM files into public/wasm)
  npm run dev

Folder notes:
- public/images/img_A.png, img_B.png, img_C.png  -> reference images
- public/models/hand_landmarker_fixed.task        -> NOT included; copy your existing model here
