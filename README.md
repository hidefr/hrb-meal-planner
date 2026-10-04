# 🍳 TasteCraft — AI-First Household Meal Planner & Kitchen Voice Copilot

TasteCraft is an AI-first weekly meal planner, smart grocery list manager, and interactive culinary voice coach built specifically for households and couples. It is designed to run seamlessly on your local workstation with your **Hermes agent** (or any OpenAI-compatible LLM endpoint), providing instant cross-device mobile access for **iPhone (iOS)**, **Android (Native APK & PWA)**, and **Desktop Web** without app store friction, plus an optional **Telegram Bot** for shared household chat.

---

## ✨ Core Features & Highlights

- **🎙️ Hands-Free Voice Cooking Mode:**
  - **Your Kitchen Sous-Chef:** Tap *"🎙️ Cook"* on any meal card to launch a full-screen, landscape-optimized, high-contrast kitchen view with zero screen timeouts.
  - **Multi-Turn Conversational AI:** Talk directly to the chef using wake-words (*"Hey Chef"*, *"Chef"*, *"TasteCraft"*, or *"Cookie"*) or direct cooking questions. Chef maintains memory across turns (e.g. asking for a substitute, then saying *"Yes, use that"*).
  - **On-The-Fly Recipe Adaptation:** Ask to swap or add ingredients mid-cook (*"Hey Chef, can I substitute honey with maple syrup?"*). Chef speaks verbal confirmation and dynamically updates the recipe's ingredient cards, amounts, and step instructions in place.
  - **Edge Neural Text-to-Speech:** High-fidelity, warm speech streaming via Edge Neural TTS (`en-US-AvaNeural`) with word-by-word visual highlighting and speed toggles (1.0x, 1.15x, 1.3x).
  - **Sensorial Cookware Coaching:** Thermal guidance tailored to your pan (*Stainless Steel Leidenfrost water-drop test, Cast Iron radiant heat, Non-Stick temperature safety, Sheet Pan spacing*).
  - **Emergency Panic Rescue:** One-touch or voice-triggered (*"Panic"*, *"It's smoking"*, *"Food is sticking"*) emergency intervention advice.
  - **Session Resume:** Smart state memory prompts you to continue where you left off or start over whenever re-entering cooking mode.

- **⚡ Anti-Homework Single-Decision Kitchen:**
  - Eradicates recipe decision fatigue. Enter 1 to 3 ingredients you have on hand in your fridge or pantry, and get a single, high-confidence dinner commitment complete with rich photography, video tutorials, and interactive voice guidance—no scrolling through 20 endless blog links.

- **💬 Conversational Household Copilot:**
  - Chat about cravings, dietary restrictions (*"under 30 minutes"*, *"high-protein"*, *"dairy-free"*, *"one-pot only"*), or ingredients to use up. Voice-to-text dictation lets you speak your thoughts into the chat box hands-free.

- **📅 Weekly Meal Plan & Past 50 Meal History:**
  - Visual Monday–Sunday board. Tap any meal to view full recipe cards, swap days, or edit manually.
  - Persistent meal history log storing up to 50 previous dinners with one-click pinning and re-planning.

- **🛒 Smart Consolidated Grocery List:**
  - Automatic ingredient aggregation across recipes categorized by store aisle (*Produce, Meat & Seafood, Dairy, Bakery, Pantry, Spices, Frozen*).
  - **Partial Stock Tracking:** Built-in steppers track items you already have on hand (*"Have 1 of 2 • Need 1 more"*).
  - **Manual Item Immunity:** Groceries added manually or via chat (*milk, eggs, snacks*) are preserved through meal plan wipes or changes.
  - **Custom Store Tagging:** Tag items for Amazon, Fred Meyer, Trader Joe's, Safeway, Costco, etc., with dedicated aisle filter tabs.
  - **Cleared History:** Recovers up to 200 checked/cleared items with a single tap.

- **🎨 Dual Adaptive Themes:**
  - **Biscuit Light Theme:** Warm cookie cream & linen palette (`#FAF6EF`), soft amber borders, high-contrast typography, and light ribbons.
  - **Espresso Dark Theme:** Deep roasted espresso & dark bronze backdrop (`#0D0A08`) for night cooking.

- **📱 Multi-Platform Deployment:**
  - **Android Native App:** Compiled standalone debug APK (`TasteCraft.apk`) with native hardware microphone and keep-awake permissions.
  - **Progressive Web App (PWA):** Instant home-screen install on iOS Safari and Android Chrome.
  - **Telegram Bot (Optional):** Plan meals and append groceries from a shared family group chat.

---

## 🏛️ Technical Architecture

```
hrb-meal-planner/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat.py             # Multi-turn chat copilot & recipe generator
│   │   │   ├── meal_plan.py        # Weekly board CRUD, history log, & pinning
│   │   │   ├── grocery.py          # Aisle aggregation, partial stock, store filters
│   │   │   ├── media.py            # Cooking video tutorials & photo enrichment
│   │   │   ├── settings.py         # Household dietary pills & custom store profiles
│   │   │   └── voice.py            # Ultra-fast voice assistant & Edge Neural TTS proxy
│   │   ├── db/                     # Atomic JSON file persistence (app_state.json)
│   │   ├── models/                 # Pydantic data schemas
│   │   ├── services/               # LLM orchestrator, grocery engine, Telegram bot
│   │   ├── config.py               # Settings loader & environment variables
│   │   └── main.py                 # FastAPI app, CORS, and static bundle serving
│   ├── data/                       # Local database files on disk
│   ├── run.py                      # Multi-interface server runner (0.0.0.0:8000)
│   └── requirements.txt            # Python dependencies (FastAPI, uvicorn, edge-tts, etc.)
│
├── frontend/
│   ├── android/                    # Capacitor Android Studio native project
│   │   └── app/build/outputs/apk/  # Native Android APK build outputs
│   ├── src/
│   │   ├── components/
│   │   │   ├── AntiHomeworkBuilder.tsx # Single-decision ingredient meal generator
│   │   │   ├── ChatCopilot.tsx         # AI chat drawer with streaming dictation
│   │   │   ├── GroceryListView.tsx     # Smart grocery manager with partial stock
│   │   │   ├── MealPlanBoard.tsx       # 7-day meal plan grid with recipe cards
│   │   │   ├── RecipeDetailModal.tsx   # Detailed recipe overview modal
│   │   │   ├── SettingsModal.tsx       # Custom stores, dietary preferences, copy plan
│   │   │   ├── UserGuideView.tsx       # Comprehensive in-app documentation & search
│   │   │   └── VoiceCookingMode.tsx    # Hands-free kitchen voice coaching assistant
│   │   ├── services/
│   │   │   ├── api.ts                  # Typed REST API service layer
│   │   │   └── useSpeechSynthesis.ts   # Edge Neural TTS client with Web Speech fallback
│   │   ├── types/                      # TypeScript domain definitions
│   │   ├── App.tsx                     # Main layout, tabs, and theme state
│   │   └── index.css                   # Tailwind CSS & theme definitions
│   ├── dist/                           # Production static web assets & TasteCraft.apk
│   ├── capacitor.config.json           # Native Android container configuration
│   └── package.json                    # React 18, Vite 5, Tailwind CSS, Capacitor 6
```

---

## 🚀 Quick Start & Installation

### 1. Backend Setup

```bash
cd backend

# Create and activate virtual environment
# Windows:
python -m venv venv
.\venv\Scripts\activate

# macOS / Linux:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment (`.env`)

Create or update `backend/.env`:

```env
# LLM Endpoint (Point to Hermes, Ollama, vLLM, LM Studio, or OpenRouter)
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=hermes
LLM_MODEL=hermes-3-llama-3.1-8b

# Host and Port (0.0.0.0 binds to all network interfaces for LAN phone access)
HOST=0.0.0.0
PORT=8000

# Optional Telegram Bot Token (from @BotFather)
TELEGRAM_BOT_TOKEN=
```

### 3. Run the Server

```bash
# From repository root or backend folder:
python run.py
```

- Local access: `http://localhost:8000`
- Network access: `http://<your-computer-ip>:8000` (e.g. `http://192.168.1.150:8000`)

---

## 📲 Installing on Mobile Phones & Tablets

### Option A: Native Android APK (Recommended for Kitchen Tablets / Android Phones)
1. On your Android device, open Chrome and navigate to `http://<your-computer-ip>:8000/TasteCraft.apk`.
2. Download and install the APK.
3. Grants full hardware microphone permissions and screen keep-awake capabilities during cooking sessions.

### Option B: Apple iPhone & iPad (Safari PWA)
1. Connect to your home Wi-Fi network.
2. Open Safari and navigate to `http://<your-computer-ip>:8000`.
3. Tap the **Share** button (box with an upward arrow) at the bottom.
4. Select **"Add to Home Screen"**.
5. TasteCraft launches full-screen as a standalone native-like app.

### Option C: Remote Supermarket Access (Outside Home Wi-Fi)
To access your grocery list and meal plan when away from your home network:
- Install [Tailscale](https://tailscale.com/) on your host machine and mobile devices (zero-config private mesh VPN).
- Or run a free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to point a secure public URL to `localhost:8000`.

---

## 🛠️ Development & Building

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Production Web Build
```bash
cd frontend
npm run build
```

### Compiling Native Android APK
```bash
cd frontend
# Sync web build to Capacitor Android project
npx cap sync android

# Compile Android APK via Gradle
cd android
.\gradlew.bat assembleDebug

# Output APK location:
# frontend/android/app/build/outputs/apk/debug/app-debug.apk
# Automatically copied to frontend/dist/TasteCraft.apk for in-app download!
```

---

## 📄 License & Attribution

Built with ❤️ for households and couples who love great food, zero decision fatigue, and seamless kitchen teamwork.
