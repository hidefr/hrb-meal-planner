# 🍳 TasteCraft — AI-First Household Meal Planner & Grocery Copilot

TasteCraft is an AI-first weekly meal planner and smart grocery list manager built specifically for households and couples. It is designed to run seamlessly on your laptop with your **Hermes agent** (or any OpenAI-compatible LLM endpoint), providing instant mobile access for both **iPhone (iOS)** and **Android** without app store friction, plus an optional **Telegram Bot** for shared chat.

---

## ✨ Features

- **💬 AI-First Conversational Co-Pilot:** 
  Discuss cravings, dietary goals (*"under 30 minutes"*, *"one-pot only"*, *"low-carb"*, *"kid friendly"*), or ingredients to use up. The AI tailors full recipes with exact measurements and step-by-step methods.
- **📅 Interactive Weekly Meal Plan:**
  Visual Monday–Sunday board. Tap any meal to view full recipe cards, swap days, or edit manually.
- **🎬 Cooking Videos & Food Photo Enrichment:**
  TasteCraft automatically searches for real-world cooking video tutorials (YouTube), appetizing dish photography, and community recipe blogs (Serious Eats, Budget Bytes, RecipeTin) to supplement your AI-tailored recipes.
- **🛒 Manageable, Consolidated Grocery List:**
  Automatically aggregates ingredients across recipes and categorizes them by store aisle (*Produce, Meat & Seafood, Dairy, Bakery, Pantry, Spices, Frozen*). Tap to check off items while in the supermarket. Includes manual "+ Add Item" support for staples, snacks, and toiletries.
- **📱 Zero-Friction Mobile App (PWA):**
  Works out of the box on iPhone and Android via Progressive Web App (PWA). Just open the link and tap *"Add to Home Screen"* for a native full-screen app experience.
- **🤖 Telegram Bot Integration (Optional):**
  Connect a Telegram bot so you and your partner can plan meals from a shared Telegram chat or send quick grocery additions.
- **🦙 Hermes & Local LLM Ready:**
  Pre-configured to connect to your local Hermes agent or any OpenAI-compatible endpoint (Ollama, vLLM, LM Studio, OpenRouter, etc.).

---

## 🏗️ Architecture

```
hrb-meal-planning/
├── backend/
│   ├── app/
│   │   ├── api/            # REST API (Chat, Meal Plan, Grocery, Media Search)
│   │   ├── db/             # JSON State Persistence (Meal plan, groceries, chat history)
│   │   ├── models/         # Pydantic Schemas
│   │   ├── services/       # LLM Agent, Grocery Engine, Media Search, Telegram Bot
│   │   ├── config.py       # Configuration loader
│   │   └── main.py         # FastAPI application with static PWA serving
│   ├── data/               # Persistent JSON state on disk
│   ├── run.py              # Launcher script
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/     # ChatCopilot, MealPlanBoard, GroceryListView, Modals
│   │   ├── services/       # API client
│   │   └── App.tsx         # Main application container
│   ├── public/             # PWA manifest.json & app icons
│   └── dist/               # Production build served directly by FastAPI
```

---

## 🚀 Quick Start

### 1. Backend Setup

```bash
cd backend
# Create virtual environment (if not already created)
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment (`.env`)

Copy `backend/.env.example` to `backend/.env` and adjust your LLM endpoint:

```env
# LLM Endpoint (Point to your Hermes agent)
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=hermes
LLM_MODEL=hermes-3-llama-3.1-8b

# Telegram Bot Token (Optional, from @BotFather)
TELEGRAM_BOT_TOKEN=

# Host and Port (0.0.0.0 enables LAN mobile access)
HOST=0.0.0.0
PORT=8000
```

### 3. Run the App

```bash
python run.py
```

The app will start at `http://0.0.0.0:8000`. Because the frontend is pre-built into `frontend/dist`, visiting `http://localhost:8000` serves both the API and the full interactive UI!

*(Optional: For frontend development with Vite hot-reloading: `cd frontend && npm run dev`)*

---

## 📲 Installing on Mobile Phones (Cross-Platform)

No app store downloads or developer certificates are required.

### Find Your Laptop's Local IP
On Windows, open PowerShell and run:
```powershell
ipconfig
```
Look for **IPv4 Address** (e.g. `192.168.1.150`).

### On iPhone (Partner):
1. Connect to the same home Wi-Fi network.
2. Open Safari and navigate to: `http://192.168.1.150:8000`
3. Tap the **Share** button (box with an upward arrow at the bottom).
4. Scroll down and select **"Add to Home Screen"**.
5. TasteCraft will appear on the home screen as a standalone app!

### On Android (You):
1. Connect to the same home Wi-Fi network.
2. Open Google Chrome and navigate to: `http://192.168.1.150:8000`
3. Tap the **three dots menu (⋮)** in the top right.
4. Tap **"Install App"** or **"Add to Home screen"**.
5. TasteCraft will launch with its own app icon and full-screen experience.

> **Tip for Shopping at the Supermarket:** To access the grocery list and meal plan when you're away from home Wi-Fi, install free [Tailscale](https://tailscale.com/) on your laptop and phones, or run a free [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/).

---

## 🤖 Telegram Bot Setup (Optional)

If you and your partner want to use Telegram:
1. Message [@BotFather](https://t.me/BotFather) on Telegram and create a new bot (e.g., `@MyFamilyMealPlannerBot`).
2. Copy the token provided and paste it into `backend/.env`:
   ```env
   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz
   ```
3. Restart `python run.py`.
4. Create a Telegram group with you and your partner, add your new bot, and make it an admin.
5. You can now chat dinner ideas or type `/plan` or `/groceries` directly in Telegram!
