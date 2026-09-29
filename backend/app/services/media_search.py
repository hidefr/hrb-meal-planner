import asyncio
import logging
import urllib.parse
from typing import List, Optional
from duckduckgo_search import DDGS
from app.models.schemas import MediaLink

logger = logging.getLogger(__name__)

POPULAR_RECIPE_BLOGS = [
    {"name": "Serious Eats", "search_slug": "seriouseats.com"},
    {"name": "Budget Bytes", "search_slug": "budgetbytes.com"},
    {"name": "RecipeTin Eats", "search_slug": "recipetineats.com"}
]

def search_recipe_media_sync(recipe_title: str, tags: Optional[List[str]] = None) -> List[MediaLink]:
    """
    Search for cooking videos, food images, and real-world recipe reference pages
    to enrich an AI-tailored recipe. Includes instant high-reliability fallbacks.
    """
    media_links: List[MediaLink] = []
    clean_title = recipe_title.strip()
    encoded_query = urllib.parse.quote_plus(f"{clean_title} recipe")

    # 1. Primary: Try DuckDuckGo Videos
    found_videos = False
    try:
        with DDGS() as ddgs:
            video_results = list(ddgs.videos(f"{clean_title} recipe cooking video", max_results=3))
            for v in video_results:
                url = v.get("content") or v.get("url")
                if url:
                    found_videos = True
                    media_links.append(MediaLink(
                        type="video",
                        title=v.get("title", f"How to Cook {clean_title}"),
                        url=url,
                        thumbnail_url=v.get("images", {}).get("medium") or v.get("image") or None,
                        source_name=v.get("publisher", "YouTube")
                    ))
    except Exception as e:
        logger.warning(f"Video search warning for '{recipe_title}': {e}")

    # Fallback to direct YouTube tutorial search link if no videos found
    if not found_videos:
        yt_search_url = f"https://www.youtube.com/results?search_query={encoded_query}+tutorial"
        media_links.append(MediaLink(
            type="video",
            title=f"Watch '{clean_title}' Cooking Tutorials on YouTube",
            url=yt_search_url,
            thumbnail_url=None,
            source_name="YouTube"
        ))

    # 2. Images: Try DuckDuckGo Images
    try:
        with DDGS() as ddgs:
            img_results = list(ddgs.images(f"{clean_title} recipe dish", max_results=2))
            for img in img_results:
                img_url = img.get("image") or img.get("thumbnail")
                if img_url:
                    media_links.append(MediaLink(
                        type="photo",
                        title=img.get("title", clean_title),
                        url=img.get("url") or img_url,
                        thumbnail_url=img_url,
                        source_name="Web Photo"
                    ))
    except Exception as e:
        logger.warning(f"Image search warning for '{recipe_title}': {e}")

    # 3. Web reference recipe pages
    found_pages = False
    try:
        with DDGS() as ddgs:
            web_results = list(ddgs.text(f"{clean_title} recipe ingredients instructions", max_results=2))
            for res in web_results:
                href = res.get("href")
                if href and "youtube.com" not in href:
                    found_pages = True
                    media_links.append(MediaLink(
                        type="recipe_page",
                        title=res.get("title", f"{clean_title} Reference Guide"),
                        url=href,
                        source_name="Recipe Guide"
                    ))
    except Exception as e:
        logger.warning(f"Web recipe search warning for '{recipe_title}': {e}")

    # If web search failed, provide direct search links to trusted recipe sites
    if not found_pages:
        for blog in POPULAR_RECIPE_BLOGS[:2]:
            blog_url = f"https://www.google.com/search?q=site%3A{blog['search_slug']}+{encoded_query}"
            media_links.append(MediaLink(
                type="recipe_page",
                title=f"Explore {clean_title} on {blog['name']}",
                url=blog_url,
                source_name=blog["name"]
            ))

    return media_links

async def search_recipe_media(recipe_title: str, tags: Optional[List[str]] = None) -> List[MediaLink]:
    """Async wrapper around duckduckgo search running in thread pool"""
    return await asyncio.to_thread(search_recipe_media_sync, recipe_title, tags)
