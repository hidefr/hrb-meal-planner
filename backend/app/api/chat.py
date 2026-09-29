from fastapi import APIRouter
from app.models.schemas import ChatRequest, ChatResponse, ChatMessage
from app.db.storage import storage
from app.services.llm_agent import llm_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/history")
async def get_history():
    return storage.get_chat_history()

@router.delete("/history")
async def clear_history():
    storage.clear_chat_history()
    return {"status": "cleared"}

@router.post("", response_model=ChatResponse)
async def post_chat(req: ChatRequest):
    meal_plan = storage.get_meal_plan()
    grocery_list = storage.get_grocery_list()
    history = storage.get_chat_history()

    # Save user message
    user_msg = ChatMessage(role="user", content=req.message)
    storage.add_chat_message(user_msg)

    # Process through LLM agent
    reply, actions, updated_plan, updated_grocery = await llm_agent.chat(
        user_message=req.message,
        history=history,
        meal_plan=meal_plan,
        grocery_list=grocery_list
    )

    # Save state
    storage.save_meal_plan(updated_plan)
    storage.save_grocery_list(updated_grocery)

    # Save assistant message
    asst_msg = ChatMessage(
        role="assistant",
        content=reply,
        applied_actions=actions if actions else None
    )
    storage.add_chat_message(asst_msg)

    return ChatResponse(
        reply=reply,
        actions_performed=actions,
        meal_plan=updated_plan,
        grocery_list=updated_grocery
    )
