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

class VoiceAskRequest(BaseModel):
    query: str
    recipe_title: str
    current_step: str = ""
    step_number: int = 1
    cookware: str = "stainless"
    ingredients: list[str] = []
    instructions: list[str] = []

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
    When user requests an ingredient substitute (e.g. "I don't have coconut milk"),
    proposes the culinary substitute in 1-2 spoken sentences AND outputs an adaptation
    JSON block so the frontend automatically updates the recipe cards and instructions in place!
    """
    clean_query = req.query.strip()
    if not clean_query:
        return VoiceAskResponse(reply="I'm listening. Ask me any question about your recipe or ingredients.")

    client = AsyncOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url
    )

    ing_summary = ", ".join(req.ingredients[:20]) if req.ingredients else "Standard pantry"

    system_prompt = (
        "You are Chef, an instant real-time kitchen voice assistant for someone cooking at the stove. "
        f"They are cooking '{req.recipe_title}'. "
        f"Current step #{req.step_number}: '{req.current_step}'. "
        f"Cookware: {req.cookware}. "
        f"Recipe ingredients: {ing_summary}. "
        "CRITICAL RULES FOR SPOKEN REPLY: Answer in 1 or 2 warm spoken sentences (maximum 35 words). "
        "Never use markdown formatting, bullet points, asterisks, or technical temperatures in the spoken response. "
        "ADAPTATION RULE: If the user asks to add an ingredient, substitute, or replace an ingredient (e.g. 'add broccoli to the recipe' or 'I don't have coconut milk, can we use milk?'), "
        "provide your warm 1-2 spoken sentences first, followed by a line starting with ADAPTATION: like this:\n"
        'ADAPTATION: {"action": "add", "old_name": "", "new_name": "broccoli", "new_amount": 1.0, "new_unit": "cup", "notes": "cut into florets"}\n'
        'or for substitutions:\n'
        'ADAPTATION: {"action": "replace", "old_name": "coconut milk", "new_name": "whole milk", "new_amount": 1.0, "new_unit": "cup", "notes": "whisk in slowly"}\n'
        "If no ingredient is being added or replaced, do NOT output any ADAPTATION line."
    )

    try:
        completion = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": clean_query}
            ],
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
            json_str = parts[1].strip().split("\n")[0].strip()
            try:
                parsed = json.loads(json_str)
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
                logger.warning(f"Failed to parse ADAPTATION line: {parse_err}")
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
            clean_reply = "I've noted that for your recipe! Let's keep cooking."

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
