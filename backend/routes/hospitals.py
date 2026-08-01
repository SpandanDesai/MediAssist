from fastapi import APIRouter, Depends, HTTPException
from utils.dependencies import get_current_user
from database import get_db
import httpx

router = APIRouter()

@router.get("/hospitals")
async def get_hospitals(lat: float, lng: float, radius: int = 5000, current_user: dict = Depends(get_current_user)):
    # Using Overpass API to get hospitals within radius
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lng});
      way["amenity"="hospital"](around:{radius},{lat},{lng});
      relation["amenity"="hospital"](around:{radius},{lat},{lng});
      
      node["amenity"="clinic"](around:{radius},{lat},{lng});
      way["amenity"="clinic"](around:{radius},{lat},{lng});
      relation["amenity"="clinic"](around:{radius},{lat},{lng});
    );
    out center;
    """
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(overpass_url, data={'data': overpass_query}, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            hospitals = []
            for element in data.get('elements', []):
                tags = element.get('tags', {})
                name = tags.get('name', 'Unknown Facility')
                
                # Overpass returns center for ways/relations and lat/lon for nodes
                element_lat = element.get('lat', element.get('center', {}).get('lat'))
                element_lng = element.get('lon', element.get('center', {}).get('lon'))
                
                hospitals.append({
                    "id": element.get('id'),
                    "name": name,
                    "type": tags.get('amenity', 'healthcare'),
                    "lat": element_lat,
                    "lng": element_lng,
                    "address": f"{tags.get('addr:street', '')} {tags.get('addr:city', '')}".strip() or None
                })
                
            return {"hospitals": hospitals}
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hospitals: {str(e)}")
