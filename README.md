# SignSteps AR — Local npm version

This version imports MediaPipe from a locally installed npm package instead of importing the JavaScript bundle from jsDelivr. The MediaPipe JavaScript package and WASM runtime are installed locally. The hand model is downloaded when first used.

## Run in VS Code

1. Install Node.js LTS if it is not installed: https://nodejs.org/
2. Extract this ZIP and open the `SignSteps_AR_Vite` folder in VS Code.
3. In VS Code, choose Terminal → New Terminal.
4. Run these commands one at a time:

   ```bash
   npm install
   npm run dev
   ```

5. The terminal will show a local address, usually `http://localhost:5173/`. Open that address.
6. Click Start camera and allow camera permission.

Do not use Live Server for this version. Run it with `npm run dev`.

## Current limitations

This is a camera + hand landmark proof of concept. The open-finger check is a simple heuristic, not validated ISL recognition. It does not yet overlay a reference sign or teach full words. The video frames are processed in the browser and are not saved or uploaded by this app.

If `npm` is not recognised, Node.js may not be installed or VS Code may need to be restarted after installing it.
