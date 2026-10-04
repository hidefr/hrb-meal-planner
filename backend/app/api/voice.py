import io
import logging
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
import edge_tts

from pydantic import BaseModel
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/voice", tags=["voice"])

DEFAULT_VOICE = "en-US-AvaNeural" # Warm, natural, friendly chef voice

# In-memory LRU-like audio cache for instantaneous, jitter-free playback
_TTS_CACHE: dict[tuple[str, str, str], bytes] = {}

import json
from typing import Optional, List, Dict, Any

class ConversationTurn(BaseModel):
    role: str # "user" or "assistant"
    content: str

class VoiceAskRequest(BaseModel):
    query: str
    recipe_title: str
    current_step: str = ""
    step_number: int = 1
    cookware: str = "stainless"
    ingredients: list[str] = []
    instructions: list[str] = []
    history: list[ConversationTurn] = []

class IngredientUpdate(BaseModel):
    old_name: str
    new_name: str
    new_amount: Optional[float] = None
    new_unit: Optional[str] = None
    notes: Optional[str] = None

class VoiceAskResponse(BaseModel):
    reply: str
    ingredient_update: Optional[IngredientUpdate] = None
    updated_instructions: Optional[List[str]] = None

@router.post("/ask", response_model=VoiceAskResponse)
async def voice_ask(req: VoiceAskRequest):
    """
    Ultra-fast, hands-free culinary advice tailored for quick voice response.
    Maintains ongoing conversational memory for the cooking session so the user can say
    "What can I replace honey with?" -> "You can use maple syrup" -> "Yes, add the maple syrup".
    When an ingredient substitute or addition is confirmed or requested, returns an adaptation
    JSON block so the frontend automatically updates the recipe cards and instructions in place!
    """
    clean_query = req.query.strip()
    if not clean_query:
        return VoiceAskResponse(reply="I'm listening. Ask me any question about your recipe or ingredients.")

    client = AsyncOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url
    )

    ing_summary = ", ".join(req.ingredients[:30]) if req.ingredients else "Standard pantry"

    system_prompt = (
        "You are Chef, an instant real-time kitchen voice assistant for someone cooking at the stove.\n"
        f"They are cooking '{req.recipe_title}'.\n"
        f"Current step #{req.step_number}: '{req.current_step}'.\n"
        f"Cookware: {req.cookware}.\n"
        f"Current recipe ingredients: {ing_summary}.\n\n"
        "CRITICAL RULES FOR SPOKEN REPLY:\n"
        "1. Answer in 1 or 2 warm spoken sentences (maximum 35 words).\n"
        "2. Never use markdown formatting, bullet points, asterisks, or technical temperatures in the spoken response.\n"
        "3. CONVERSATIONAL CONTEXT: You maintain context with the cook across earlier turns in this session. "
        "For example, if you previously recommended maple syrup as a substitute for honey, and the user now says 'Yes, add the maple syrup' "
        "or 'Replace honey with maple syrup' or 'Go ahead and use maple syrup', you MUST recognize that they are confirming the replacement of honey with maple syrup!\n\n"
        "4. ADAPTATION RULE:\n"
        "Whenever the user asks to add an ingredient, substitute/replace an ingredient, OR confirms a previously discussed substitute "
        "(e.g. 'add maple syrup', 'replace honey with maple syrup', 'yes do that', 'can we use maple syrup instead', 'let's use that'), "
        "you MUST trigger the ingredient update for the recipe cards!\n"
        "Provide your warm 1-2 spoken sentences first, followed by a separate line starting with ADAPTATION: like this:\n"
        'ADAPTATION: {"action": "replace", "old_name": "honey", "new_name": "maple syrup", "new_amount": 1.0, "new_unit": "tbsp", "notes": "whisk in"}\n'
        "or for additions:\n"
        'ADAPTATION: {"action": "add", "old_name": "", "new_name": "broccoli", "new_amount": 1.0, "new_unit": "cup", "notes": "cut into florets"}\n'
        "Always infer the closest matched existing ingredient for 'old_name' from the current ingredients or prior conversation.\n"
        "If no ingredient change is being made or confirmed, do NOT output any ADAPTATION line."
    )

    # Build messages with full cooking conversation history
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    
    # Keep last 8 turns of conversation for rich immediate context
    if req.history:
        for turn in req.history[-8:]:
            messages.append({"role": turn.role, "content": turn.content})

    messages.append({"role": "user", "content": clean_query})

    try:
        completion = await client.chat.completions.create(
            model=settings.llm_model,
            messages=messages,
            max_tokens=600,
            temperature=0.2
        )
        raw_reply = completion.choices[0].message.content or ""
        
        spoken_reply = raw_reply
        ingredient_update = None

        # Check for ADAPTATION: line or ```json block
        if "ADAPTATION:" in raw_reply:
            parts = raw_reply.split("ADAPTATION:")
            spoken_reply = parts[0].strip()
            # Find the JSON part
            json_str = parts[1].strip()
            if "\n" in json_str:
                json_candidate = json_str.split("\n")[0].strip()
            else:
                json_candidate = json_str.strip()
            try:
                parsed = json.loads(json_candidate)
                adapt = parsed.get("adaptation") if isinstance(parsed, dict) and "adaptation" in parsed else parsed
                if adapt and isinstance(adapt, dict) and adapt.get("new_name"):
                    ingredient_update = IngredientUpdate(
                        old_name=str(adapt.get("old_name", "")),
                        new_name=str(adapt.get("new_name", "")),
                        new_amount=float(adapt["new_amount"]) if adapt.get("new_amount") is not None else None,
                        new_unit=str(adapt.get("new_unit", "")) if adapt.get("new_unit") else None,
                        notes=str(adapt.get("notes", "")) if adapt.get("notes") else None
                    )
            except Exception as parse_err:
                logger.warning(f"Failed to parse ADAPTATION line: {parse_err}. Raw line was: {json_str[:150]}")
        elif "```json" in raw_reply:
            parts = raw_reply.split("```json")
            spoken_reply = parts[0].strip()
            json_text = parts[1].split("```")[0].strip()
            try:
                parsed = json.loads(json_text)
                adapt = parsed.get("adaptation") if isinstance(parsed, dict) and "adaptation" in parsed else parsed
                if adapt and isinstance(adapt, dict) and adapt.get("new_name"):
                    ingredient_update = IngredientUpdate(
                        old_name=str(adapt.get("old_name", "")),
                        new_name=str(adapt.get("new_name", "")),
                        new_amount=float(adapt["new_amount"]) if adapt.get("new_amount") is not None else None,
                        new_unit=str(adapt.get("new_unit", "")) if adapt.get("new_unit") else None,
                        notes=str(adapt.get("notes", "")) if adapt.get("notes") else None
                    )
            except Exception as parse_err:
                logger.warning(f"Failed to parse adaptation JSON: {parse_err}")

        # Clean any remaining markdown artifacts from spoken text
        clean_reply = spoken_reply.replace("*", "").replace("#", "").replace("`", "").strip()
        if not clean_reply:
            clean_reply = "I've updated that for your recipe! Let's keep cooking."

        return VoiceAskResponse(
            reply=clean_reply,
            ingredient_update=ingredient_update
        )
    except Exception as e:
        logger.error(f"Voice ask error: {e}")
        return VoiceAskResponse(reply="I couldn't reach the culinary coach right now. Try asking again in a moment.")

@router.get("/tts")
async def text_to_speech(
    text: str = Query(..., description="Text to synthesize"),
    voice: str = Query(DEFAULT_VOICE, description="Edge TTS voice code"),
    rate: str = Query("+10%", description="Edge TTS rate e.g. +0%, +10%, +20%")
):
    """
    Synthesize human-natural, warm, empathetic speech using neural TTS.
    Returns audio/mpeg stream directly playable in browser or Android app.
    """
    clean_text = text.strip()
    if not clean_text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    # Limit to reasonable length
    if len(clean_text) > 2000:
        clean_text = clean_text[:2000]

    # Validate rate formatting
    if not rate.endswith("%"):
        rate = "+10%"

    cache_key = (clean_text, voice, rate)
    if cache_key in _TTS_CACHE:
        return Response(
            content=_TTS_CACHE[cache_key],
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=86400, immutable"
            }
        )

    try:
        communicate = edge_tts.Communicate(clean_text, voice=voice, rate=rate, pitch="+0Hz")
        audio_stream = io.BytesIO()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_stream.write(chunk["data"])

        audio_bytes = audio_stream.getvalue()
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="Failed to synthesize audio")

        # Cache if under 1000 items
        if len(_TTS_CACHE) < 1000:
            _TTS_CACHE[cache_key] = audio_bytes

        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Cache-Control": "public, max-age=3600"
            }
        )
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/voices")
async def list_available_voices():
    """
    Return curated selection of high-quality neural voices
    """
    return [
        {"id": "en-US-AvaNeural", "name": "Ava (Warm & Empathetic - Recommended)", "gender": "Female"},
        {"id": "en-US-AndrewNeural", "name": "Andrew (Calm & Clear)", "gender": "Male"},
        {"id": "en-US-EmmaNeural", "name": "Emma (Bright & Friendly)", "gender": "Female"},
        {"id": "en-US-BrianNeural", "name": "Brian (Professional Chef)", "gender": "Male"},
        {"id": "en-US-AnaNeural", "name": "Ana (Gentle & Patient)", "gender": "Female"},
    ]
