"""Seeded corridor definitions shared by seed.py and the /api/corridor endpoint."""

CORRIDOR_DEFS: list[dict] = [
    {
        "slug": "hospital-corridor-a",
        "name": "Hospital Corridor A",
        "hospital_name": "Government Medical College Hospital",
        "intersection_codes": ["INT-01", "INT-02", "INT-05", "INT-07", "INT-10"],
        "is_demo": True,
        "queue_n": [8, 6, 7, 5, 9],
        "weather": "dry",
    },
    {
        "slug": "trauma-route-b",
        "name": "Trauma Route B",
        "hospital_name": "City Trauma Care Centre",
        "intersection_codes": ["INT-03", "INT-09", "INT-12", "INT-14", "INT-08"],
        "is_demo": False,
        "queue_n": [6, 5, 8, 4, 7],
        "weather": "wet",
    },
    {
        "slug": "cardiac-express-c",
        "name": "Cardiac Express C",
        "hospital_name": "Heart Institute",
        "intersection_codes": ["INT-04", "INT-06", "INT-13", "INT-11", "INT-15"],
        "is_demo": False,
        "queue_n": [5, 4, 6, 7, 3],
        "weather": "fog",
    },
]

CORRIDOR_BY_SLUG: dict[str, dict] = {c["slug"]: c for c in CORRIDOR_DEFS}
