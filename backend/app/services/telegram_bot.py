import logging
import asyncio
from typing import Optional
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, ContextTypes, filters
from app.config import settings
from app.db.storage import storage
from app.services.llm_agent import llm_agent, format_meal_plan_summary, format_grocery_summary
from app.models.schemas import ChatMessage

logger = logging.getLogger(__name__)

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    msg = (
        "👋 *Welcome to TasteCraft!* 🍳\n\n"
        "I'm your AI meal planner co-pilot. You and your partner can use this chat to plan meals together, "
        "tailor recipes, and manage your weekly grocery list.\n\n"
        "*Quick Commands:*\n"
        "• `/plan` - View this week's current meal plan\n"
        "• `/groceries` - View current categorized shopping list\n"
        "• `/help` - Show help\n\n"
        "*Or simply chat:* Tell me what you're craving, constraints for the week (e.g. 'Plan 4 dinners, 30-min one-pot, low carb'), "
        "or say 'Add oat milk and coffee to grocery list'!"
    )
    if update.message:
        await update.message.reply_text(msg, parse_mode="Markdown")

async def plan_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    plan = storage.get_meal_plan()
    summary = format_meal_plan_summary(plan)
    text = f"📅 *This Week's Meal Plan:*\n\n{summary}"
    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")

async def groceries_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    grocery = storage.get_grocery_list()
    summary = format_grocery_summary(grocery)
    text = f"🛒 *Current Grocery List:*\n\n{summary}"
    if update.message:
        await update.message.reply_text(text, parse_mode="Markdown")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.text:
        return
    
    user_text = update.message.text
    user_name = update.effective_user.first_name if update.effective_user else "Someone"

    # Send typing action
    await update.message.chat.send_action("typing")

    meal_plan = storage.get_meal_plan()
    grocery_list = storage.get_grocery_list()
    history = storage.get_chat_history()

    # Save to chat history
    storage.add_chat_message(ChatMessage(role="user", content=f"{user_name}: {user_text}"))

    # Run agent
    reply, actions, updated_plan, updated_grocery = await llm_agent.chat(
        user_message=f"{user_name} says: {user_text}",
        history=history,
        meal_plan=meal_plan,
        grocery_list=grocery_list
    )

    # Save updated state
    storage.save_meal_plan(updated_plan)
    storage.save_grocery_list(updated_grocery)
    storage.add_chat_message(ChatMessage(
        role="assistant",
        content=reply,
        applied_actions=actions if actions else None
    ))

    # Send response
    response_text = reply
    if actions:
        action_bullets = "\n".join([f"✨ {a}" for a in actions])
        response_text += f"\n\n*Actions Applied:*\n{action_bullets}"

    await update.message.reply_text(response_text)

class TelegramBotService:
    def __init__(self):
        self.app: Optional[Application] = None
        self._task: Optional[asyncio.Task] = None

    async def start(self):
        token = settings.telegram_bot_token.strip()
        if not token:
            logger.info("[Telegram] Bot token not configured. Skipping Telegram bot runner.")
            return

        logger.info("[Telegram] Initializing Telegram Bot service...")
        self.app = Application.builder().token(token).build()

        self.app.add_handler(CommandHandler("start", start_command))
        self.app.add_handler(CommandHandler("help", start_command))
        self.app.add_handler(CommandHandler("plan", plan_command))
        self.app.add_handler(CommandHandler("groceries", groceries_command))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

        await self.app.initialize()
        await self.app.start()
        await self.app.updater.start_polling()
        logger.info("[Telegram] Bot is polling for messages.")

    async def stop(self):
        if self.app and self.app.updater and self.app.updater.running:
            await self.app.updater.stop()
            await self.app.stop()
            await self.app.shutdown()
            logger.info("[Telegram] Bot stopped.")

telegram_service = TelegramBotService()
