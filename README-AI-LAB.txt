SIGNSTEPS AR — AI LEARNING LAB ADD-ON

IMPORTANT: This is an add-on for your existing Vite/MediaPipe project. Do not delete or replace app.js, index.html, style.css, public/images, public/models, or public/wasm.

FILES TO COPY
- ai-learning-lab.html
- ai-learning-lab.css
- ai-learning-lab.js
- server.js (updated backend; replaces the backend you added earlier)
- vite.config.js (merge with your existing config if you already have one)
- .gitignore (merge lines into existing file; do not overwrite unrelated rules)

1. Copy the three ai-learning-lab files and server.js into the project root beside package.json.
2. Copy vite.config.js into the project root. If you already have a vite.config.js, add the /api proxy section to its existing server config instead of replacing unrelated settings.
3. Check .env at the project root. It must contain GEMINI_API_KEY=your_actual_key. Never share or commit .env.
4. In package.json, add this entry to scripts, keeping the existing scripts:
   "server": "node server.js"
   Example scripts: { "dev": "vite", "server": "node server.js", "postinstall": "node copy-wasm.mjs" }
5. In the existing .gitignore, add .env and node_modules/ if not already present.
6. Keep two terminals running from the project root:
   Terminal 1: node server.js
   Terminal 2: npm run dev
7. Open the Vite address shown in terminal (usually http://localhost:5173/ai-learning-lab.html).
8. Ask a question. Then use Know More Hand Gestures -> Try all 3 tutor styles. Evaluation scores are manual; enter only scores you have actually assessed.

The AI page does not modify the original SignSteps AR screen. To add a navigation button to the original page, add this link somewhere appropriate inside index.html:
<a href="/ai-learning-lab.html">Explore AI Learning Lab</a>
Style it using your existing design. Alternatively open /ai-learning-lab.html directly.

LIMITATIONS
- The tutor accepts questions about any hand gesture or sign, not only A/B/C. The model may still make mistakes; verify exact ISL/ASL signs, finger positions, movement, and cultural meanings with trusted references or qualified instructors. This prototype does not yet retrieve verified references automatically.
- Prompt comparison uses actual API requests and may consume quota. Evaluation results are not generated automatically or fabricated.
- This is an educational prototype, not a validated sign-language recognition system.
