# FitAI Companion - Android Build Guide

Your application has been successfully configured with **Ionic Capacitor**, converting your modern React + Vite + Tailwind web application into a fully-functional native Android app.

We have scaffolded and prepared all native dependencies, configurations, and build tasks so that you can open, build, and run the native mobile application seamlessly.

---

## What We Configured
1. **Capacitor Configuration**: Set up `capacitor.config.ts` targeting package ID `com.fitai.companion` and pointing to the `dist` web assets directory.
2. **Native Project**: Scaffolded the complete, production-ready directory under `/android`, containing the Gradle wrapper, config sheets, and compiler parameters.
3. **NPM Scripts**: Integrated helper scripts in `package.json` to streamline native workflows:
   - `npm run android:build`: Builds production web assets using Vite and syncs them directly into the Android package.
   - `npm run cap:sync`: Synchronizes web bundle modifications and updates native Capacitor plugins.
   - `npm run cap:open`: Launches the project automatically in **Android Studio**.

---

## Local Development & Compilation Guide

To run or build the `.apk` on your local development machine, follow these simple steps:

### 📋 Prerequisites
Ensure you have the following installed on your machine:
- **Node.js** (v18 or higher)
- **Java Development Kit (JDK 17)** (required by Modern Gradle/Capacitor builds)
- **Android Studio** (containing the Android SDK, Build Tools, and Emulator/Virtual Devices)

---

### Step-by-Step Instructions

#### 1. Setup Dependencies
If you've freshly exported or checked out the repository, run:
```bash
npm install
```

#### 2. Synthesize and Synchronize Web Assets
Compile the React code and copy the assets straight to the native assets layer of the Android module:
```bash
npm run android:build
```
*Note: This command runs `vite build && cap sync` to compile assets into `dist/` and instantly updates the Android folder.*

#### 3. Open in Android Studio
Use our npm helper to open the native project file in your installed Android Studio instance:
```bash
npm run cap:open
```
*Optionally, you can open Android Studio manually and select the `/android` directory inside the project root.*

#### 4. Run on a Device or Emulator
Inside Android Studio:
1. Wait for standard Gradle file indexing to complete.
2. Connect your physical Android device (with USB debugging enabled) or select a Virtual Device (AVD Emulator).
3. Click the green **Run** button (`Shift + F10` or play icon) at the top menu to auto-install and boot the app on your screen.

#### 5. Generate his native APK (Offline Release)
To build a shareable `.apk` installer without needing a developer environment running:
1. In Android Studio, go to the top menu option: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
2. Once complete, click the **Locate** button in the popup notification to get your release-ready `app-debug.apk` file!
