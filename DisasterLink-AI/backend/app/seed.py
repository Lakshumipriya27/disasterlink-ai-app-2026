"""Seed the SIMULATED Chennai flood scenario.

Every record created here is fictional and flagged is_simulated=True. Names, phone numbers and
incidents are invented for academic demonstration only. Run directly with:  python -m app.seed
"""
import random
from datetime import timedelta

from .config import UPLOAD_DIR
from .database import Base, SessionLocal, engine
from .models import (DisasterScenario, EmergencyRequest, MissingPersonReport, Organization, Resource, ResourceMatch,
                     Role, Shelter, SOSAlert, User, Volunteer, VolunteerAssignment, VulnerablePerson, WelfareCheck,
                     utcnow)
from .security import hash_password
from .services.audit import log, notify
from .services.family import refresh_suggestions
from .services.geo import AREAS
from .services.pipeline import process_new_request

DEMO_USERS = [
    ("admin", "Demo Administrator", "Admin@2026", "admin"),
    ("coordinator", "Demo Relief Coordinator", "Coord@2026", "coordinator"),
    ("volunteer", "Demo Volunteer", "Volunteer@2026", "volunteer"),
    ("public", "Demo Public User", "Public@2026", "public"),
]

ROLES = [("admin", "Full access including settings and user management"),
         ("coordinator", "Relief operations: verify, prioritise, match, approve"),
         ("volunteer", "View operations, manage own assignments"),
         ("public", "Public features and request tracking")]


def _jitter(area, rng, spread=0.012):
    lat, lng = AREAS[area]
    return round(lat + rng.uniform(-spread, spread), 5), round(lng + rng.uniform(-spread, spread), 5)


# (id, area, location, text, people, flags, hours_ago, status, verification, phone, hint)
REQUESTS = [
    ("SIM001", "North Chennai", "Royapuram fishing hamlet", "80 people in our street have no drinking water since yesterday. Water cans needed urgently.", 80, "ec", 20, "verified", "verified", "9000000101", "water"),
    ("SIM002", "North Chennai", "Royapuram fishing hamlet", "No drinking water for 80 people in Royapuram hamlet since yesterday, please send water cans", 80, "", 18, "pending", "unverified", "9000000101", "water"),
    ("SIM003", "North Chennai", "Tondiarpet, near market", "Family of 5 trapped on first floor, water rising fast, elderly mother cannot walk. Need boat rescue.", 5, "ed", 2, "verified", "verified", "9000000102", "rescue"),
    ("SIM004", "North Chennai", "Kasimedu", "Need food packets for 40 people sheltering in community hall, children are hungry", 40, "c", 14, "in_progress", "verified", "9000000103", "food"),
    ("SIM005", "Velachery", "Velachery main road, 2nd street", "Diabetic patient needs insulin, all medicines washed away. 3 elderly people in house.", 3, "em", 9, "verified", "verified", "9000000104", "medicine"),
    ("SIM006", "Velachery", "Vijayanagar", "12 families need medicine kits - fever and diarrhoea spreading after flood water entered houses", 12, "cm", 11, "verified", "verified", "9000000105", "medicine"),
    ("SIM007", "Velachery", "Velachery lake side", "Pregnant woman with labour pain, road flooded chest deep, need ambulance or boat immediately", 2, "p", 1, "verified", "verified", "9000000106", "transport"),
    ("SIM008", "Velachery", "Taramani link road", "Need dry clothes and blankets for 15 people, everything got wet", 15, "c", 16, "pending", "unverified", "9000000107", "clothing"),
    ("SIM009", "Velachery", "Vijayanagar", "Medicine kits needed for 12 families, fever and diarrhea spreading in Vijayanagar after flood", 12, "", 10, "pending", "unverified", "9000000105", "medicine"),
    ("SIM010", "Tambaram", "West Tambaram, Kannan street", "House collapsed due to heavy rain, 6 people need shelter tonight", 6, "c", 7, "verified", "verified", "9000000108", "shelter"),
    ("SIM011", "Tambaram", "Chitlapakkam", "Need food for 25 people, no cooking possible, ground floor flooded", 25, "e", 22, "fulfilled", "verified", "9000000109", "food"),
    ("SIM012", "Tambaram", "East Tambaram", "Drinking water needed for 30 residents of apartment, motor not working", 30, "", 13, "verified", "verified", "9000000110", "water"),
    ("SIM013", "Tambaram", "Selaiyur", "Wheelchair user needs transport to accessible shelter, lift not working and water entering", 2, "d", 4, "verified", "verified", "9000000111", "transport"),
    ("SIM014", "Avadi", "Avadi bus depot area", "Need food packets for 20 workers stranded at depot", 20, "", 12, "verified", "verified", "9000000112", "food"),
    ("SIM015", "Avadi", "Pattabiram", "Elderly couple living alone, need medicines for blood pressure and some food", 2, "em", 15, "pending", "unverified", "9000000113", "medicine"),
    ("SIM016", "Avadi", "Thirumullaivoyal", "Fallen tree blocking road, need help clearing for ambulance access", 50, "", 19, "fulfilled", "verified", "9000000114", "other"),
    ("SIM017", "Perungudi", "Perungudi industrial estate", "Electric shock risk - live wire fallen in flood water near houses, one person unconscious", 4, "", 1.5, "verified", "verified", "9000000115", "rescue"),
    ("SIM018", "Perungudi", "Kandanchavadi", "Need drinking water and food for 35 people in a school building", 35, "c", 8, "verified", "verified", "9000000116", "water"),
    ("SIM019", "Perungudi", "Thoraipakkam junction", "Need tarpaulin and shelter supplies, roof damaged for 4 families", 16, "c", 17, "pending", "unverified", "9000000117", "shelter"),
    ("SIM020", "Perungudi", "Perungudi", "Dialysis patient needs transport to hospital today, roads cut off", 1, "m", 6, "verified", "verified", "9000000118", "transport"),
    ("SIM021", "Pallikaranai", "Pallikaranai marsh road", "Water entered houses near marsh, 10 people need food", 10, "e", 5, "pending", "unverified", "9000000119", "food"),
    ("SIM022", "North Chennai", "Ennore", "Need blankets and clothes for 30 people in relief camp", 30, "ce", 21, "fulfilled", "verified", "9000000120", "clothing"),
    ("SIM023", "Tambaram", "Mudichur road junction", "Saapadu venum, 8 per family hungry, no shops open", 8, "c", 3, "pending", "unverified", "9000000121", "food"),
    ("SIM024", "Avadi", "Avadi", "Thanni illai, kudineer venum for our street, 20 people", 20, "", 9, "verified", "verified", "9000000122", "water"),
    ("SIM025", "Velachery", "Velachery 100 ft road", "Need 10 medicine kits for first aid, minor injuries from debris", 10, "", 12, "verified", "verified", "9000000123", "medicine"),
    ("SIM026", "North Chennai", "Tondiarpet, near market", "Family trapped on first floor with elderly mother who cannot walk, water rising, please send rescue boat", 5, "ed", 1.8, "pending", "unverified", "9000000124", "rescue"),
    ("SIM027", "Perungudi", "Kandanchavadi", "Asthma patient needs inhaler and oxygen, breathing difficulty", 1, "m", 2.5, "verified", "verified", "9000000125", "medicine"),
    ("SIM028", "Tambaram", "Tambaram sanatorium", "Need transport for 12 people to relief camp", 12, "e", 10, "in_progress", "verified", "9000000126", "transport"),
]

FLAG = {"e": "has_elderly", "c": "has_children", "d": "has_disabled", "m": "has_medical_condition", "p": "has_pregnant"}


def seed(db) -> dict:
    rng = random.Random(42)
    now = utcnow()

    roles = {}
    for name, desc in ROLES:
        r = Role(name=name, description=desc)
        db.add(r)
        roles[name] = r
    db.flush()

    orgs = [
        Organization(id="ORG-SIM01", name="Chennai Relief Collective (SIMULATED)", org_type="NGO",
                     contact="relief-collective@example.org", service_areas=["North Chennai", "Avadi"], is_simulated=True),
        Organization(id="ORG-SIM02", name="South Chennai Volunteers Trust (SIMULATED)", org_type="Trust",
                     contact="scvt@example.org", service_areas=["Velachery", "Perungudi", "Pallikaranai"], is_simulated=True),
        Organization(id="ORG-SIM03", name="Tambaram Community Kitchen (SIMULATED)", org_type="Community group",
                     contact="kitchen@example.org", service_areas=["Tambaram", "Mudichur"], is_simulated=True),
        Organization(id="ORG-SIM04", name="MediAid Mobile Clinics (SIMULATED)", org_type="Medical NGO",
                     contact="mediaid@example.org", service_areas=["Velachery", "North Chennai"], is_simulated=True),
        Organization(id="ORG-SIM05", name="Coastal Boat Rescue Network (SIMULATED)", org_type="Rescue",
                     contact="boats@example.org", service_areas=["North Chennai", "Perungudi"], is_simulated=True),
        Organization(id="ORG-SIM06", name="Avadi Youth Welfare Forum (SIMULATED)", org_type="Youth group",
                     contact="aywf@example.org", service_areas=["Avadi"], is_simulated=True),
    ]
    db.add_all(orgs)

    zones = [
        {"area": "North Chennai", "lat": 13.1210, "lng": 80.2880, "radius_km": 4.5, "severity": 0.75,
         "estimated_affected_population": 9000, "note": "Simulated coastal and canal overflow"},
        {"area": "Velachery", "lat": 12.9815, "lng": 80.2180, "radius_km": 3.5, "severity": 0.85,
         "estimated_affected_population": 8000, "note": "Simulated lake overflow, low-lying streets"},
        {"area": "Tambaram", "lat": 12.9249, "lng": 80.1000, "radius_km": 4, "severity": 0.6,
         "estimated_affected_population": 6000, "note": "Simulated heavy rainfall flooding"},
        {"area": "Avadi", "lat": 13.1147, "lng": 80.1018, "radius_km": 3.5, "severity": 0.45,
         "estimated_affected_population": 3500, "note": "Simulated localised waterlogging"},
        {"area": "Perungudi", "lat": 12.9654, "lng": 80.2461, "radius_km": 3, "severity": 0.7,
         "estimated_affected_population": 5000, "note": "Simulated drain overflow"},
        {"area": "Pallikaranai", "lat": 12.9349, "lng": 80.2137, "radius_km": 3.5, "severity": 0.9,
         "estimated_affected_population": 7000, "note": "Simulated marshland flooding - very low request volume"},
        {"area": "Mudichur", "lat": 12.9120, "lng": 80.0700, "radius_km": 3, "severity": 0.8,
         "estimated_affected_population": 4500, "note": "Simulated Adyar tributary overflow - no requests received"},
    ]
    db.add(DisasterScenario(id="SCN-SIM01", name="Chennai Northeast Monsoon Flood (SIMULATED)",
                            disaster_type="flood", impact_zones=zones, started_at=now - timedelta(hours=26),
                            description="Fictional flood scenario for academic demonstration. Impact levels, "
                                        "populations and incidents are SIMULATED and do not describe real events."))

    shelters = [
        Shelter(id="SHL-SIM01", name="Corporation School Shelter, Royapuram (SIMULATED)", area="North Chennai",
                address="Royapuram (fictional)", lat=13.1145, lng=80.2925, capacity=250, occupancy=210,
                wheelchair_accessible=False, drinking_water=True, food_available=True, medical_support=False,
                family_rooms=True, contact="Shelter desk 9000000201", is_simulated=True),
        Shelter(id="SHL-SIM02", name="Community Hall Shelter, Velachery (SIMULATED)", area="Velachery",
                address="Velachery (fictional)", lat=12.9790, lng=80.2215, capacity=180, occupancy=120,
                wheelchair_accessible=True, accessibility_verified=False, accessible_toilets=False,
                drinking_water=True, food_available=True, medical_support=True, contact="9000000202", is_simulated=True),
        Shelter(id="SHL-SIM03", name="Accessible Relief Centre, Guindy (SIMULATED)", area="Velachery",
                address="Guindy (fictional)", lat=13.0067, lng=80.2206, capacity=150, occupancy=60,
                wheelchair_accessible=True, accessibility_verified=True, accessible_toilets=True, drinking_water=True,
                food_available=True, medical_support=True, family_rooms=True, women_safe_space=True,
                contact="9000000203", is_simulated=True),
        Shelter(id="SHL-SIM04", name="Marriage Hall Shelter, Tambaram (SIMULATED)", area="Tambaram",
                address="West Tambaram (fictional)", lat=12.9230, lng=80.1100, capacity=300, occupancy=295,
                wheelchair_accessible=True, accessibility_verified=True, accessible_toilets=True,
                drinking_water=True, food_available=True, medical_support=False, family_rooms=True,
                contact="9000000204", is_simulated=True),
        Shelter(id="SHL-SIM05", name="Government College Shelter, Avadi (SIMULATED)", area="Avadi",
                address="Avadi (fictional)", lat=13.1190, lng=80.0990, capacity=400, occupancy=140,
                wheelchair_accessible=True, accessibility_verified=True, accessible_toilets=False,
                drinking_water=True, food_available=True, medical_support=True, family_rooms=False,
                women_safe_space=True, contact="9000000205", is_simulated=True),
        Shelter(id="SHL-SIM06", name="Temple Mandapam Shelter, Perungudi (SIMULATED)", area="Perungudi",
                address="Perungudi (fictional)", lat=12.9620, lng=80.2420, capacity=120, occupancy=40,
                wheelchair_accessible=False, drinking_water=False, food_available=True, medical_support=False,
                contact="9000000206", is_simulated=True),
    ]
    db.add_all(shelters)

    def res(i, name, cat, qty, unit, area, org, loc, expiry_days=None, reserved=0):
        lat, lng = _jitter(area, rng, 0.008)
        return Resource(id=f"RES-SIM{i:02d}", name=f"{name} (SIMULATED)", category=cat, quantity=qty, unit=unit,
                        area=area, organization_id=org, location_name=loc, lat=lat, lng=lng, reserved_quantity=reserved,
                        expiry_date=(now + timedelta(days=expiry_days)) if expiry_days is not None else None,
                        availability="depleted" if qty <= reserved else "limited" if qty - reserved < 20 else "available",
                        is_simulated=True)

    resources = [
        res(1, "Drinking water cans (20L)", "water", 20, "cans", "North Chennai", "ORG-SIM01", "Royapuram depot", 60),
        res(2, "Cooked food packets", "food", 120, "packets", "North Chennai", "ORG-SIM01", "Kasimedu kitchen", 1),
        res(3, "Blankets", "clothing", 60, "pieces", "North Chennai", "ORG-SIM01", "Ennore store"),
        res(4, "Rescue boats", "transport", 3, "boats", "North Chennai", "ORG-SIM05", "Royapuram jetty"),
        res(5, "Medicine kits (basic)", "medicine", 10, "kits", "Velachery", "ORG-SIM04", "Velachery mobile clinic", 120),
        res(6, "Insulin & diabetic supplies", "medicine", 6, "kits", "Velachery", "ORG-SIM04", "Velachery clinic", 20),
        res(7, "Drinking water bottles (1L)", "water", 150, "bottles", "Velachery", "ORG-SIM02", "Velachery school", 90),
        res(8, "Dry clothes bundles", "clothing", 40, "bundles", "Velachery", "ORG-SIM02", "Taramani hall"),
        res(9, "Food packets", "food", 200, "packets", "Tambaram", "ORG-SIM03", "Tambaram community kitchen", 2),
        res(10, "Dry ration kits", "food", 80, "kits", "Tambaram", "ORG-SIM03", "Chitlapakkam store", -1),
        res(11, "Shelter tarpaulins", "shelter", 25, "sheets", "Tambaram", "ORG-SIM03", "Tambaram store"),
        res(12, "Accessible van", "transport", 2, "vehicles", "Tambaram", "ORG-SIM03", "Selaiyur"),
        res(13, "Drinking water bottles (1L)", "water", 600, "bottles", "Avadi", "ORG-SIM06", "Avadi godown", 180),
        res(14, "Food packets", "food", 90, "packets", "Avadi", "ORG-SIM06", "Avadi kitchen", 1),
        res(15, "BP & general medicines", "medicine", 25, "kits", "Avadi", "ORG-SIM04", "Pattabiram PHC", 200),
        res(16, "Drinking water cans (20L)", "water", 15, "cans", "Perungudi", "ORG-SIM02", "Kandanchavadi", 45),
        res(17, "Food packets", "food", 30, "packets", "Perungudi", "ORG-SIM02", "Perungudi kitchen", 3),
        res(18, "Oxygen cylinders (portable)", "medicine", 4, "cylinders", "Perungudi", "ORG-SIM04", "Perungudi clinic"),
        res(19, "Ambulance / transfer vehicle", "transport", 1, "vehicles", "Perungudi", "ORG-SIM04", "Perungudi"),
        res(20, "Shelter tarpaulins", "shelter", 10, "sheets", "Perungudi", "ORG-SIM02", "Thoraipakkam"),
        res(21, "Blankets", "clothing", 150, "pieces", "Avadi", "ORG-SIM06", "Avadi godown"),
        res(22, "Food packets", "food", 40, "packets", "Pallikaranai", "ORG-SIM02", "Pallikaranai temple", 2),
        res(23, "Infant milk powder", "food", 30, "tins", "Velachery", "ORG-SIM02", "Velachery school", 5),
    ]
    db.add_all(resources)
    db.flush()

    # Emergency requests: process through the same AI pipeline as live submissions
    reqs = {}
    for (rid, area, loc, text, people, flags, hrs, status, ver, phone, hint) in REQUESTS:
        lat, lng = _jitter(area, rng)
        if rid == "SIM026":  # near-duplicate of SIM003 at the same spot
            lat, lng = reqs["SIM003"].lat + 0.0004, reqs["SIM003"].lng - 0.0003
        if rid == "SIM002":
            lat, lng = reqs["SIM001"].lat + 0.0006, reqs["SIM001"].lng + 0.0002
        if rid == "SIM009":
            lat, lng = reqs["SIM006"].lat - 0.0005, reqs["SIM006"].lng + 0.0004
        r = EmergencyRequest(id=f"REQ-{rid}", source="web", requester_name=f"Simulated Resident {rid[-3:]}",
                             contact_phone=phone, description=text, people_affected=people, quantity_needed=0,
                             location_name=loc, area=area, lat=lat, lng=lng, created_at=now - timedelta(hours=hrs),
                             is_simulated=True, **{FLAG[f]: True for f in flags})
        db.add(r)
        db.flush()
        process_new_request(db, r, hint_category=hint, use_external=False)
        r.status, r.verification_status = status, ver
        r.verified_by = "coordinator" if ver == "verified" else None
        r.updated_at = r.created_at + timedelta(hours=min(hrs * 0.6, 8)) if status == "fulfilled" else r.created_at
        reqs[rid] = r
    # one offline-synced example
    reqs["SIM021"].synced_from_offline = True
    reqs["SIM021"].source = "offline_sync"
    reqs["SIM021"].offline_created_at = reqs["SIM021"].created_at - timedelta(hours=3)
    # one coordinator override example
    reqs["SIM015"].urgency_override = "high"
    reqs["SIM015"].override_reason = "Welfare call confirmed both residents are over 80 and BP medication ran out."
    reqs["SIM015"].overridden_by = "coordinator"
    db.flush()

    # Existing match history (approved / dispatched / fulfilled examples)
    db.add_all([
        ResourceMatch(id="MATCH-SIM01", request_id="REQ-SIM011", resource_id="RES-SIM09", quantity=25,
                      distance_km=2.1, score=0.82, status="fulfilled", decided_by="coordinator",
                      destination="Chitlapakkam", explanation=["Category match: food -> food.",
                                                               "Distance 2.1 km.", "Covers 100% of need."]),
        ResourceMatch(id="MATCH-SIM02", request_id="REQ-SIM004", resource_id="RES-SIM02", quantity=40,
                      distance_km=1.3, score=0.86, status="dispatched", decided_by="coordinator",
                      destination="Kasimedu", explanation=["Category match: food -> food.", "Distance 1.3 km.",
                                                           "Stock expires in 1 day - using it first reduces wastage."]),
        ResourceMatch(id="MATCH-SIM03", request_id="REQ-SIM028", resource_id="RES-SIM12", quantity=1,
                      distance_km=3.0, score=0.7, status="approved", decided_by="coordinator",
                      destination="Tambaram sanatorium", explanation=["Category match: transport -> transport."]),
    ])
    resources[1].reserved_quantity = 40   # RES-SIM02 dispatched
    resources[11].reserved_quantity = 1   # RES-SIM12 approved

    # Vulnerable people registry (fictional)
    vps = [
        ("VP-SIM01", "Simulated Resident A. (82)", "Pallikaranai", ["elderly_alone", "mobility"], "Lives alone on ground floor; uses walker", "Needs ramp access and accessible transport", 1, 60),
        ("VP-SIM02", "Simulated Resident B. (67)", "Pallikaranai", ["medical"], "Weekly dialysis at hospital", "None", 2, None),
        ("VP-SIM03", "Simulated Resident C. (45)", "Pallikaranai", ["visual"], "Totally blind; needs guided evacuation", "Audio instructions; guide person", 1, None),
        ("VP-SIM04", "Simulated Resident D. (78)", "Mudichur", ["elderly_alone", "medical"], "Insulin-dependent diabetic", "Refrigerated insulin storage", 1, None),
        ("VP-SIM05", "Simulated Resident E. (34)", "Mudichur", ["mobility", "accessible_transport"], "Wheelchair user", "Wheelchair-accessible shelter and toilet", 3, None),
        ("VP-SIM06", "Simulated Resident F. (71)", "Mudichur", ["hearing", "elderly_alone"], "Profoundly deaf; uses sign language / written notes", "Visual alerts; written communication", 1, None),
        ("VP-SIM07", "Simulated Resident G. (88)", "Velachery", ["elderly_alone", "mobility"], "Bedridden", "Stretcher transport", 1, 6),
        ("VP-SIM08", "Simulated Resident H. (29)", "Velachery", ["medical", "special_shelter"], "Pregnant (8 months)", "Shelter with medical support", 2, 30),
        ("VP-SIM09", "Simulated Resident I. (52)", "North Chennai", ["mobility"], "Below-knee amputee", "Accessible transport", 4, 10),
        ("VP-SIM10", "Simulated Resident J. (75)", "Tambaram", ["elderly_alone", "medical"], "Heart condition, on daily medication", "Medication continuity", 1, None),
        ("VP-SIM11", "Simulated Resident K. (10)", "Perungudi", ["special_shelter", "medical"], "Child with autism and epilepsy", "Quiet space in shelter; seizure medication", 4, 40),
        ("VP-SIM12", "Simulated Resident L. (69)", "Avadi", ["visual", "elderly_alone"], "Low vision", "Large-print / audio information", 1, 20),
    ]
    for vid, name, area, cats, req_txt, acc, hh, checked_hrs in vps:
        lat, lng = _jitter(area, rng, 0.01)
        v = VulnerablePerson(id=vid, display_name=name, contact_phone=f"90000003{vid[-2:]}", area=area, lat=lat,
                             lng=lng, categories=cats, assistance_requirements=req_txt, accessibility_requirements=acc,
                             household_size=hh, emergency_contact="Simulated relative 9000000399",
                             address_hint=f"Fictional address, {area}", consent_status="given",
                             consent_date=now - timedelta(days=rng.randint(30, 300)),
                             last_verified=now - timedelta(days=rng.randint(10, 90)), is_simulated=True)
        db.add(v)
        if checked_hrs is not None:
            db.add(WelfareCheck(person=v, attempted_at=now - timedelta(hours=checked_hrs),
                                method="phone", outcome="safe" if checked_hrs > 15 else "needs_assistance",
                                notes="Simulated welfare call", performed_by="coordinator"))

    # Volunteers
    vols = [
        ("VOL-SIM01", "Simulated Volunteer Arun", "ORG-SIM01", ["food_distribution", "water_distribution"], "North Chennai", "Two-wheeler; Tamil & English", True, "available"),
        ("VOL-SIM02", "Simulated Volunteer Priya", "ORG-SIM04", ["welfare_checks", "general_relief"], "Velachery", "Nurse; first aid", False, "available"),
        ("VOL-SIM03", "Simulated Volunteer Karthik", "ORG-SIM05", ["transportation"], "North Chennai", "Boat operator; swimmer", True, "busy"),
        ("VOL-SIM04", "Simulated Volunteer Meena", "ORG-SIM03", ["food_distribution", "shelter_assistance"], "Tambaram", "Cook; crowd management", False, "available"),
        ("VOL-SIM05", "Simulated Volunteer Rahul", "ORG-SIM06", ["transportation", "water_distribution"], "Avadi", "Van driver", True, "available"),
        ("VOL-SIM06", "Simulated Volunteer Divya", "ORG-SIM02", ["welfare_checks", "shelter_assistance"], "Pallikaranai", "Sign language (ISL) basics", False, "available"),
        ("VOL-SIM07", "Simulated Volunteer Suresh", "ORG-SIM02", ["general_relief"], "Perungudi", "Electrician", False, "offline"),
        ("VOL-SIM08", "Simulated Volunteer Fathima", None, ["welfare_checks"], "Mudichur", "Local resident; knows elderly residents", False, "available"),
    ]
    for vid, name, org, types, area, skills, vehicle, avail in vols:
        lat, lng = AREAS[area]
        db.add(Volunteer(id=vid, name=name, phone=f"90000004{vid[-2:]}", organization_id=org, assistance_types=types,
                         service_area=area, lat=lat, lng=lng, skills=skills, has_vehicle=vehicle, availability=avail,
                         approval_status="pending" if vid == "VOL-SIM08" else "approved", is_simulated=True))
    db.flush()
    db.add(VolunteerAssignment(id="ASG-SIM01", volunteer_id="VOL-SIM03", task_type="request",
                               reference_id="REQ-SIM004", description="Deliver food packets to Kasimedu hall",
                               status="accepted", assigned_by="coordinator"))
    db.add(VolunteerAssignment(id="ASG-SIM02", volunteer_id="VOL-SIM02", task_type="welfare_check",
                               reference_id="VP-SIM07", description="Welfare visit to bedridden resident",
                               status="assigned", assigned_by="coordinator"))
    reqs["SIM004"].assigned_volunteer_id = "VOL-SIM03"

    # SOS alerts (simulated)
    sos_specs = [("SOS-SIM01", "Velachery", ["rescue"], False, 0.6, "awaiting_response", ["wheelchair user"]),
                 ("SOS-SIM02", "Perungudi", ["medicine"], True, 3, "acknowledged", []),
                 ("SOS-SIM03", "North Chennai", ["rescue", "water"], False, 5, "assisted", [])]
    for sid, area, cats, silent, hrs, st, needs in sos_specs:
        lat, lng = _jitter(area, rng, 0.006)
        s = SOSAlert(id=sid, category=cats[0], categories=cats, silent=silent, lat=lat, lng=lng, accuracy_m=25,
                     location_status="captured", area=area, accessibility_needs=needs, assistance_status=st,
                     verification_status="verified" if st != "awaiting_response" else "unverified",
                     created_at=now - timedelta(hours=hrs), is_simulated=True)
        db.add(s)
        db.flush()
        r = EmergencyRequest(id=f"REQ-{sid.replace('-', '')}", source="sos", lat=lat, lng=lng, area=area,
                             description="One-touch SOS alert. " + " ".join(f"Needs {c}." for c in cats) +
                                         (f" Accessibility needs: {', '.join(needs)}." if needs else ""),
                             location_name="GPS location", created_at=s.created_at, is_simulated=True,
                             has_disabled=bool(needs))
        db.add(r)
        db.flush()
        process_new_request(db, r, hint_category=cats[0], is_sos=True, use_external=False)
        s.request_id = r.id
        if st == "assisted":
            r.status, r.verification_status = "fulfilled", "verified"
        elif st == "acknowledged":
            r.status, r.verification_status = "in_progress", "verified"

    # Family reconnection (fictional)
    mp = [
        MissingPersonReport(id="MPR-SIM01", report_type="missing", person_name="Simulated Child Lakshmi R", age=9,
                            gender="female", description="Wearing blue school uniform, red hair band",
                            family_reference="Mother - Simulated Parent R", last_known_location="Velachery bus stand",
                            lat=12.9800, lng=80.2190, last_seen_at=now - timedelta(hours=10), area="Velachery",
                            reporter_contact="9000000501", consent_to_share=True, is_simulated=True),
        MissingPersonReport(id="MPR-SIM02", report_type="found", person_name="Lakshmi (child, surname unknown)", age=8,
                            gender="female", description="Girl in blue uniform with red hair band, says she lives near lake",
                            last_known_location="Accessible Relief Centre, Guindy", lat=13.0067, lng=80.2206,
                            last_seen_at=now - timedelta(hours=6), area="Velachery",
                            reporter_contact="Shelter desk 9000000203", consent_to_share=True, is_simulated=True),
        MissingPersonReport(id="MPR-SIM03", report_type="missing", person_name="Simulated Elder Murugan S", age=74,
                            gender="male", description="Uses walking stick, white dhoti, hard of hearing",
                            family_reference="Son - Simulated Relative S", last_known_location="Tambaram market",
                            lat=12.9250, lng=80.1170, last_seen_at=now - timedelta(hours=20), area="Tambaram",
                            reporter_contact="9000000502", consent_to_share=False, is_simulated=True),
        MissingPersonReport(id="MPR-SIM04", report_type="found", person_name="Unknown elderly man", age=75,
                            gender="male", description="Elderly man with walking stick, hard of hearing, white dhoti",
                            last_known_location="Marriage Hall Shelter, Tambaram", lat=12.9230, lng=80.1100,
                            last_seen_at=now - timedelta(hours=12), area="Tambaram",
                            reporter_contact="Shelter desk 9000000204", consent_to_share=True, is_simulated=True),
    ]
    db.add_all(mp)
    db.flush()
    refresh_suggestions(db)

    # Users (demo credentials documented in README; local academic demo only)
    for uname, full, pwd, role in DEMO_USERS:
        db.add(User(username=uname, full_name=full, hashed_password=hash_password(pwd), role_id=roles[role].id,
                    volunteer_id="VOL-SIM01" if role == "volunteer" else None, is_demo=True))

    notify(db, "system", "Simulated flood scenario loaded",
           "All data is SIMULATED for academic demonstration.", "info")
    log(db, "system", "demo_seeded", "scenario", "SCN-SIM01")
    db.commit()
    return {"requests": db.query(EmergencyRequest).count(), "resources": len(resources), "shelters": len(shelters),
            "vulnerable": len(vps), "organizations": len(orgs), "volunteers": len(vols), "sos": len(sos_specs)}


def init_db(seed_if_empty: bool = True):
    Base.metadata.create_all(bind=engine)
    if seed_if_empty:
        db = SessionLocal()
        try:
            if db.query(Role).count() == 0:
                seed(db)
        finally:
            db.close()


def reset_and_seed() -> dict:
    engine.dispose()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    for f in UPLOAD_DIR.glob("*"):
        if f.is_file():
            f.unlink()
    db = SessionLocal()
    try:
        return seed(db)
    finally:
        db.close()


if __name__ == "__main__":
    print("Resetting database and seeding SIMULATED Chennai flood scenario...")
    print(reset_and_seed())
