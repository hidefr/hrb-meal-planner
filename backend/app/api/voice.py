import io
import logging
import httpx
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
    ingredient_updates: Optional[List[IngredientUpdate]] = None
    updated_instructions: Optional[List[str]] = None

def safe_float(val: Any) -> Optional[float]:
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        if isinstance(val, str) and "/" in val:
            try:
                parts = val.strip().split("/")
                return float(parts[0]) / float(parts[1])
            except Exception:
                pass
        return 1.0

def parse_raw_adapt_data(data: Any) -> list[IngredientUpdate]:
    res: list[IngredientUpdate] = []
    if not data:
        return res
    items = data if isinstance(data, list) else [data]
    for item in items:
        if not isinstance(item, dict):
            continue
        obj = item.get("adaptation") if isinstance(item.get("adaptation"), dict) else item
        if obj.get("new_name"):
            try:
                res.append(IngredientUpdate(
                    old_name=str(obj.get("old_name", "")),
                    new_name=str(obj.get("new_name", "")),
                    new_amount=safe_float(obj.get("new_amount")),
                    new_unit=str(obj.get("new_unit", "")) if obj.get("new_unit") else None,
                    notes=str(obj.get("notes", "")) if obj.get("notes") else None
                ))
            except Exception as e:
                logger.warning(f"Failed to cast IngredientUpdate: {e}")
    return res

import re

def extract_adaptations_and_clean_reply(raw_text: str) -> tuple[str, list[IngredientUpdate]]:
    clean_spoken = raw_text
    updates: list[IngredientUpdate] = []

    # 1. Search for ```json ... ``` blocks
    code_block_matches = re.findall(r"```(?:json)?\s*([\s\S]*?)\s*```", raw_text, re.IGNORECASE)
    for block in code_block_matches:
        try:
            parsed = json.loads(block.strip())
            updates.extend(parse_raw_adapt_data(parsed))
        except Exception as e:
            logger.warning(f"Failed to parse json code block: {e}")

    # 2. Search for ADAPTATION: lines or blocks
    if "ADAPTATION:" in raw_text:
        parts = raw_text.split("ADAPTATION:")
        clean_spoken = parts[0].strip()
        for tail in parts[1:]:
            tail_clean = tail.strip()
            # Try to match balanced array [...] or object {...}
            bracket_match = re.search(r"(\[[\s\S]*?\]|\{[\s\S]*?\})", tail_clean)
            if bracket_match:
                try:
                    parsed = json.loads(bracket_match.group(1))
                    updates.extend(parse_raw_adapt_data(parsed))
                    continue
                except Exception:
                    pass
            # Fallback line-by-line parse
            for line in tail_clean.split("\n"):
                line_str = line.strip()
                if line_str.startswith("{") or line_str.startswith("["):
                    try:
                        parsed = json.loads(line_str)
                        updates.extend(parse_raw_adapt_data(parsed))
                    except Exception:
                        pass

    # Strip code blocks and ADAPTATION text from the spoken reply
    clean_spoken = re.sub(r"```(?:json)?[\s\S]*?```", "", clean_spoken, flags=re.IGNORECASE)
    clean_spoken = re.sub(r"ADAPTATION:[\s\S]*", "", clean_spoken, flags=re.IGNORECASE).strip()
    clean_spoken = clean_spoken.replace("*", "").replace("#", "").replace("`", "").strip()

    return clean_spoken, updates


def format_quantity(amount: Optional[float], unit: Optional[str], name: str) -> str:
    """Format an ingredient nicely, e.g. '1 tsp paprika' or 'salt'."""
    parts = []
    if amount is not None and amount > 0:
        if amount == int(amount):
            parts.append(str(int(amount)))
        else:
            parts.append(f"{amount:.2f}".rstrip("0").rstrip("."))
    if unit:
        parts.append(unit)
    parts.append(name)
    return " ".join(parts)


def update_instructions_with_adaptations(
    instructions: list[str],
    updates: list[IngredientUpdate],
    current_step_idx: int = 0
) -> list[str]:
    """
    Intelligently rewrite and adapt cooking instructions when ingredients are substituted or added.
    - For substitutions: replaces mentions of the old ingredient with the new ingredient.
    - For additions (e.g. rub spices, seasonings, extra items): finds the most relevant seasoning/rub/cooking
      step and naturally integrates them into the directions.
    - Preserves sentence clarity and guarantees idempotency (no duplicate mentions).
    """
    if not instructions or not updates:
        return instructions

    result = list(instructions)
    added_items: list[tuple[str, str, str]] = []  # (formatted_str, notes, raw_name)

    for upd in updates:
        new_name = (upd.new_name or "").strip()
        if not new_name:
            continue
        old_name = (upd.old_name or "").strip()

        # CASE 1: SUBSTITUTION / REPLACEMENT
        if old_name:
            replaced_any = False
            cleaned_old = re.sub(
                r"^(?:[\d/\.\s]+(?:cup|tbsp|tsp|oz|lb|g|can|pinch|clove|slice)s?\s+)?(?:diced|chopped|minced|sliced|fresh|raw|pure|ground)?\s*",
                "",
                old_name,
                flags=re.IGNORECASE
            ).strip()
            patterns = [old_name]
            if cleaned_old and cleaned_old.lower() != old_name.lower():
                patterns.append(cleaned_old)

            for idx, step in enumerate(result):
                mod_step = step
                for pat in patterns:
                    regex = re.compile(rf"\b{re.escape(pat)}\b", re.IGNORECASE)
                    if regex.search(mod_step):
                        mod_step = regex.sub(new_name, mod_step)
                        replaced_any = True
                result[idx] = mod_step

            # If old_name wasn't explicitly found in any step text, attach a note to the current step
            if not replaced_any:
                t_idx = current_step_idx if 0 <= current_step_idx < len(result) else 0
                step = result[t_idx]
                if new_name.lower() not in step.lower():
                    result[t_idx] = f"{step.rstrip('.')} (Note: Use {new_name} in place of {old_name})."

        # CASE 2: ADDITION (no old_name)
        else:
            fmt = format_quantity(upd.new_amount, upd.new_unit, new_name)
            added_items.append((fmt, upd.notes or "", new_name))

    # Now handle all additions cleanly
    if added_items:
        valid_adds = []
        for fmt, notes, raw_n in added_items:
            # Check if this item is already mentioned in any instruction
            if not any(raw_n.lower() in s.lower() for s in result):
                valid_adds.append((fmt, notes, raw_n))

        if valid_adds:
            items_list = [f[0] for f in valid_adds]
            if len(items_list) == 1:
                items_phrase = items_list[0]
            elif len(items_list) == 2:
                items_phrase = f"{items_list[0]} and {items_list[1]}"
            else:
                items_phrase = f"{', '.join(items_list[:-1])}, and {items_list[-1]}"

            is_seasoning = any(
                kw in " ".join([f[0] + " " + f[1] for f in valid_adds]).lower()
                for kw in ["spice", "rub", "season", "powder", "paprika", "pepper", "salt", "herb", "cumin", "oregano", "garlic"]
            )

            target_idx = -1
            seasoning_kw = ["season", "rub", "marinade", "marinate", "coat", "spice", "sprinkle", "toss", "whisk", "mix", "combine"]

            if is_seasoning:
                # Look forward from current step
                for idx in range(current_step_idx, len(result)):
                    if any(kw in result[idx].lower() for kw in seasoning_kw):
                        target_idx = idx
                        break
                # Look backward if not found forward
                if target_idx == -1:
                    for idx in range(len(result)):
                        if any(kw in result[idx].lower() for kw in seasoning_kw):
                            target_idx = idx
                            break

            if target_idx == -1:
                target_idx = current_step_idx if 0 <= current_step_idx < len(result) else 0

            target_step = result[target_idx].strip()
            notes_hint = valid_adds[0][1].strip()

            if "rub" in notes_hint.lower() or "rub" in target_step.lower():
                phrase = f"Incorporate {items_phrase} into the rub."
            elif "marinade" in notes_hint.lower() or "marinade" in target_step.lower():
                phrase = f"Add {items_phrase} to the marinade."
            elif "season" in target_step.lower() or is_seasoning:
                phrase = f"Season additionally with {items_phrase}."
            else:
                context = f" ({notes_hint})" if notes_hint else ""
                phrase = f"Add {items_phrase}{context}."

            if target_step.endswith("."):
                result[target_idx] = f"{target_step} {phrase}"
            else:
                result[target_idx] = f"{target_step}. {phrase}"

    return result


@router.post("/ask", response_model=VoiceAskResponse)
async def voice_ask(req: VoiceAskRequest):
    """
    Ultra-fast, hands-free culinary advice tailored for quick voice response.
    Maintains ongoing conversational memory for the cooking session.
    When an ingredient substitute or addition is confirmed or requested, returns an adaptation
    JSON block so the frontend automatically updates the recipe cards and instructions in place!
    Supports multiple simultaneous additions/substitutions (e.g. adding paprika, garlic powder, onion powder).
    """
    clean_query = req.query.strip()
    if not clean_query:
        return VoiceAskResponse(reply="I'm listening. Ask me any question about your recipe or ingredients.")

    client = AsyncOpenAI(
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url
    )

    ing_summary = ", ".join(req.ingredients[:35]) if req.ingredients else "Standard pantry"

    system_prompt = (
        "You are Chef, an instant real-time kitchen voice assistant for someone cooking at the stove.\n"
        f"They are cooking '{req.recipe_title}'.\n"
        f"Current step #{req.step_number}: '{req.current_step}'.\n"
        f"Cookware: {req.cookware}.\n"
        f"Current recipe ingredients: {ing_summary}.\n\n"
        "CRITICAL RULES FOR SPOKEN REPLY:\n"
        "1. Answer in 1 or 2 warm, clear spoken sentences (maximum 35 words).\n"
        "2. Never use markdown formatting, bullet points, asterisks, or technical jargon in the spoken response.\n"
        "3. EXPLICIT SPOKEN CONFIRMATION OF SUBSTITUTIONS & ADDITIONS:\n"
        "Whenever the user asks to substitute, replace, or add an ingredient (or confirms previous suggestions like spices/rubs), your spoken sentence MUST clearly and explicitly announce all changes out loud! For example: 'Got it, I added paprika, garlic powder, and onion powder to your recipe cards!' or 'Sure, I replaced honey with maple syrup.' Never stay silent or omit items you suggested.\n"
        "4. WHEN AN INGREDIENT IS NOT IN THE RECIPE OR CANNOT BE CHANGED:\n"
        "If the user asks to replace an ingredient that does NOT exist in this recipe, explicitly tell them out loud: 'This recipe doesn't call for honey, but I can add maple syrup if you'd like!' Always explain clearly whether you made the change or why you couldn't.\n"
        "5. CONVERSATIONAL CONTEXT:\n"
        "You maintain context with the cook across earlier turns in this session. "
        "If you previously recommended paprika, garlic powder, and onion powder, and the user now says 'adjust the recipe to add your suggestions' or 'yes add those', you MUST recognize that they are confirming ALL of those items!\n\n"
        "6. ADAPTATION RULE:\n"
        "Whenever the user asks to add an ingredient, substitute/replace an ingredient, OR confirms previously discussed suggestions, "
        "you MUST trigger the ingredient update for the recipe cards!\n"
        "Provide your warm 1-2 spoken sentences first, followed by a separate line starting with ADAPTATION: with a JSON list like this:\n"
        'ADAPTATION: [{"action": "add", "old_name": "", "new_name": "paprika", "new_amount": 1.0, "new_unit": "tsp", "notes": "for the rub"}, {"action": "add", "old_name": "", "new_name": "garlic powder", "new_amount": 1.0, "new_unit": "tsp", "notes": "for the rub"}, {"action": "add", "old_name": "", "new_name": "onion powder", "new_amount": 1.0, "new_unit": "tsp", "notes": "for the rub"}]\n'
        "or for a single replacement:\n"
        'ADAPTATION: [{"action": "replace", "old_name": "honey", "new_name": "maple syrup", "new_amount": 1.0, "new_unit": "tbsp", "notes": "whisk in"}]\n'
        "Always include ALL confirmed ingredients in the ADAPTATION list.\n"
        "If no ingredient change is being made or confirmed, do NOT output any ADAPTATION line.\n\n"
        "7. UNCLEAR, NONSENSICAL, OR OFF-TOPIC QUERIES:\n"
        "If the cook asks something unclear, garbled, nonsensical, or not related to this recipe, "
        "reply in 1 warm, natural spoken sentence acknowledging what you heard and letting them know what you can help with: "
        "e.g. 'I didn't quite catch how that fits with this dish, but I can help you with ingredients, steps, or adjustments!'"
    )

    # Build messages with full cooking conversation history
    messages: list[dict[str, str]] = [{"role": "system", "content": system_prompt}]
    
    # Keep last 8 turns of conversation for rich immediate context
    if req.history:
        for turn in req.history[-8:]:
            # Prevent duplicating current query if it was already passed in history
            if turn.role == "user" and turn.content.strip().lower() == clean_query.lower():
                continue
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
        
        clean_reply, ingredient_updates = extract_adaptations_and_clean_reply(raw_reply)

        if not clean_reply:
            if ingredient_updates:
                names = ", ".join(u.new_name for u in ingredient_updates)
                clean_reply = f"I've updated your recipe cards with {names}!"
            else:
                clean_reply = "I've noted that for your recipe! Let's keep cooking."

        first_update = ingredient_updates[0] if ingredient_updates else None

        updated_instructions = None
        if ingredient_updates and req.instructions:
            current_step_idx = max(0, req.step_number - 1)
            updated_instructions = update_instructions_with_adaptations(
                req.instructions,
                ingredient_updates,
                current_step_idx
            )

        return VoiceAskResponse(
            reply=clean_reply,
            ingredient_update=first_update,
            ingredient_updates=ingredient_updates if ingredient_updates else None,
            updated_instructions=updated_instructions
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

    # 1. If ElevenLabs API key is configured, synthesize using ElevenLabs Turbo model
    if settings.elevenlabs_api_key:
        el_voice = settings.elevenlabs_voice_id or "21m00Tcm4TlvDq8ikWAM"
        el_key = (clean_text, f"el-{el_voice}", "")
        if el_key in _TTS_CACHE:
            return Response(
                content=_TTS_CACHE[el_key],
                media_type="audio/mpeg",
                headers={
                    "Content-Type": "audio/mpeg",
                    "Cache-Control": "public, max-age=86400, immutable"
                }
            )
        try:
            async with httpx.AsyncClient(timeout=10.0) as http_client:
                el_resp = await http_client.post(
                    f"https://api.elevenlabs.io/v1/text-to-speech/{el_voice}",
                    headers={
                        "xi-api-key": settings.elevenlabs_api_key,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg"
                    },
                    json={
                        "text": clean_text,
                        "model_id": settings.elevenlabs_model_id or "eleven_turbo_v2_5",
                        "voice_settings": {
                            "stability": 0.5,
                            "similarity_boost": 0.75
                        }
                    }
                )
                if el_resp.status_code == 200 and el_resp.content:
                    if len(_TTS_CACHE) < 1000:
                        _TTS_CACHE[el_key] = el_resp.content
                    return Response(
                        content=el_resp.content,
                        media_type="audio/mpeg",
                        headers={
                            "Content-Type": "audio/mpeg",
                            "Cache-Control": "public, max-age=3600"
                        }
                    )
                else:
                    logger.warning(f"ElevenLabs TTS returned HTTP {el_resp.status_code}. Falling back to Edge TTS.")
        except Exception as e:
            logger.warning(f"ElevenLabs synthesis error, falling back to Edge TTS: {e}")

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
