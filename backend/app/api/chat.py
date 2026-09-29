from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.models.schemas import ChatRequest, ChatResponse, ChatMessage, Conversation, ConversationSummary
from app.db.storage import storage
from app.services.llm_agent import llm_agent

router = APIRouter(prefix="/api/chat", tags=["chat"])

class CreateConversationRequest(BaseModel):
    title: Optional[str] = None

class RenameConversationRequest(BaseModel):
    title: str

@router.get("/conversations", response_model=List[ConversationSummary])
async def list_conversations():
    return storage.get_conversations()

@router.post("/conversations", response_model=Conversation)
async def create_conversation(req: CreateConversationRequest = CreateConversationRequest()):
    return storage.create_conversation(title=req.title)

@router.get("/conversations/{conv_id}", response_model=Conversation)
async def get_conversation(conv_id: str):
    conv = storage.get_conversation(conv_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str):
    success = storage.delete_conversation(conv_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"status": "deleted", "id": conv_id}

@router.patch("/conversations/{conv_id}", response_model=Conversation)
async def rename_conversation(conv_id: str, req: RenameConversationRequest):
    conv = storage.rename_conversation(conv_id, req.title)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

# Legacy endpoints for backward compatibility
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

    # Identify conversation
    conv_id = req.conversation_id
    if not conv_id:
        convs = storage.get_conversations()
        if convs:
            conv_id = convs[0].id
        else:
            new_conv = storage.create_conversation()
            conv_id = new_conv.id

    conv = storage.get_conversation(conv_id)
    if not conv:
        conv = storage.create_conversation()
        conv_id = conv.id

    # Save user message immediately to the conversation
    user_msg = ChatMessage(role="user", content=req.message)
    storage.add_message_to_conversation(conv_id, user_msg)

    # Process through LLM agent with conversation's history
    history = conv.messages
    reply, actions, updated_plan, updated_grocery = await llm_agent.chat(
        user_message=req.message,
        history=history,
        meal_plan=meal_plan,
        grocery_list=grocery_list
    )

    # Save meal plan & grocery list changes
    storage.save_meal_plan(updated_plan)
    storage.save_grocery_list(updated_grocery)

    # Save assistant message to the conversation
    asst_msg = ChatMessage(
        role="assistant",
        content=reply,
        applied_actions=actions if actions else None
    )
    storage.add_message_to_conversation(conv_id, asst_msg)

    return ChatResponse(
        reply=reply,
        conversation_id=conv_id,
        actions_performed=actions,
        meal_plan=updated_plan,
        grocery_list=updated_grocery
    )
