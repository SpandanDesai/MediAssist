"""Nearby hospital discovery via the OpenStreetMap Overpass API."""

from __future__ import annotations

import logging
import math
import time
from typing import Any

import httpx

from app.core.config import get_settings
from app.schemas.hospitals import HospitalListResponse, HospitalOut

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, HospitalListResponse]] = {}


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _element_name(tags: dict[str, Any]) -> str:
    return str(tags.get("name") or tags.get("operator") or "Healthcare facility")


def _element_type(tags: dict[str, Any]) -> str:
    amenity = str(tags.get("amenity") or "")
    healthcare = str(tags.get("healthcare") or "")
    if amenity == "hospital" or healthcare == "hospital":
        return "Hospital"
    if amenity == "clinic" or healthcare == "clinic":
        return "Clinic"
    if "emergency" in tags or tags.get("emergency") == "yes":
        return "Emergency"
    return healthcare.title() or amenity.title() or "Healthcare"


def _address(tags: dict[str, Any]) -> str | None:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:suburb"),
    ]
    joined = ", ".join(str(part) for part in parts if part)
    return joined or tags.get("addr:full")


def _fallback_hospitals(lat: float, lng: float) -> HospitalListResponse:
    """Deterministic nearby placeholders used when Overpass is unreachable."""
    offsets = [
        (0.012, 0.008, "City General Hospital", "Hospital"),
        (-0.009, 0.015, "Community Care Clinic", "Clinic"),
        (0.006, -0.011, "Urgent Care Center", "Emergency"),
        (-0.015, -0.006, "Family Health Clinic", "Clinic"),
        (0.018, -0.004, "Regional Medical Center", "Hospital"),
    ]
    hospitals: list[HospitalOut] = []
    for index, (dlat, dlng, name, kind) in enumerate(offsets):
        plat, plng = lat + dlat, lng + dlng
        hospitals.append(
            HospitalOut(
                id=f"local-{index}",
                name=name,
                type=kind,
                distance=round(_haversine_km(lat, lng, plat, plng), 2),
                address="Approximate location near you (offline fallback)",
                phone=None,
                latitude=plat,
                longitude=plng,
                is_open=None,
            )
        )
    hospitals.sort(key=lambda item: item.distance or 999)
    return HospitalListResponse(hospitals=hospitals, source="fallback")


async def find_nearby_hospitals(lat: float, lng: float, radius: int = 5000) -> HospitalListResponse:
    settings = get_settings()
    cache_key = f"{round(lat, 3)}:{round(lng, 3)}:{radius}"
    cached = _cache.get(cache_key)
    now = time.time()
    if cached and now - cached[0] < settings.hospital_cache_ttl_seconds:
        return cached[1]

    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lng});
      way["amenity"="hospital"](around:{radius},{lat},{lng});
      node["amenity"="clinic"](around:{radius},{lat},{lng});
      way["amenity"="clinic"](around:{radius},{lat},{lng});
      node["healthcare"~"hospital|clinic|centre|center|urgent_care"](around:{radius},{lat},{lng});
      way["healthcare"~"hospital|clinic|centre|center|urgent_care"](around:{radius},{lat},{lng});
      node["emergency"="yes"](around:{radius},{lat},{lng});
    );
    out center tags 40;
    """

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(settings.overpass_url, data={"data": query})
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logger.warning("Overpass lookup failed: %s", exc)
        result = _fallback_hospitals(lat, lng)
        _cache[cache_key] = (now, result)
        return result

    hospitals: list[HospitalOut] = []
    for element in payload.get("elements") or []:
        tags = element.get("tags") or {}
        if element.get("type") == "node":
            elat = element.get("lat")
            elng = element.get("lon")
        else:
            center = element.get("center") or {}
            elat = center.get("lat")
            elng = center.get("lon")
        if elat is None or elng is None:
            continue
        hospitals.append(
            HospitalOut(
                id=str(element.get("id")),
                name=_element_name(tags),
                type=_element_type(tags),
                distance=round(_haversine_km(lat, lng, float(elat), float(elng)), 2),
                address=_address(tags),
                phone=tags.get("phone") or tags.get("contact:phone"),
                latitude=float(elat),
                longitude=float(elng),
                is_open=None,
            )
        )

    hospitals.sort(key=lambda item: item.distance or 999)
    # Deduplicate by rounded coordinates + name
    seen: set[str] = set()
    unique: list[HospitalOut] = []
    for hospital in hospitals:
        key = f"{hospital.name.lower()}|{round(hospital.latitude, 4)}|{round(hospital.longitude, 4)}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(hospital)
    result = HospitalListResponse(hospitals=unique[:25], source="openstreetmap")
    if not result.hospitals:
        result = _fallback_hospitals(lat, lng)
    _cache[cache_key] = (now, result)
    return result
