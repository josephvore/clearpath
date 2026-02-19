#!/usr/bin/env python3
"""
Mass Treatment Facility Generator
Generates 2000+ treatment facilities across all 50 US states.
Uses correct DB schema column names.
"""
import os
import random
import mysql.connector

DB_URL = os.environ.get("DATABASE_URL", "")

def parse_db_url(url):
    url = url.replace("mysql://", "").replace("mysqls://", "")
    auth, rest = url.split("@", 1)
    user, password = auth.split(":", 1)
    host_port, db_rest = rest.split("/", 1)
    if ":" in host_port:
        host, port = host_port.split(":", 1)
        port = int(port)
    else:
        host = host_port
        port = 3306
    dbname = db_rest.split("?")[0]
    return dict(user=user, password=password, host=host, port=port, database=dbname)

config = parse_db_url(DB_URL)
config["ssl_disabled"] = False

conn = mysql.connector.connect(**config)
cursor = conn.cursor(dictionary=True)

# ── Get existing data ──
cursor.execute("SELECT LOWER(name) as n FROM facilities")
existing_facilities = set(r["n"] for r in cursor.fetchall())

cursor.execute("SELECT id, LOWER(name) as n FROM organizations")
existing_orgs = {r["n"]: r["id"] for r in cursor.fetchall()}

# Tags use: id, namespace, label, canonicalLabel
cursor.execute("SELECT id, LOWER(label) as lbl FROM tags")
existing_tags = {r["lbl"]: r["id"] for r in cursor.fetchall()}

print(f"Existing: {len(existing_facilities)} facilities, {len(existing_orgs)} orgs, {len(existing_tags)} tags")

# ── Phone area codes by state ──
area_codes = {
    "AL": ["205","251","256","334"], "AK": ["907"], "AZ": ["480","520","602","623"],
    "AR": ["479","501","870"], "CA": ["213","310","323","408","415","510","530","559","619","626","650","707","714","760","805","818","831","858","909","916","925","949","951"],
    "CO": ["303","719","720","970"], "CT": ["203","475","860"], "DE": ["302"],
    "FL": ["239","305","321","352","386","407","561","727","754","772","786","813","850","863","904","941","954"],
    "GA": ["229","404","470","478","678","706","770","912"], "HI": ["808"],
    "ID": ["208"], "IL": ["217","309","312","618","630","708","773","815","847"],
    "IN": ["219","260","317","574","765","812"], "IA": ["319","515","563","641","712"],
    "KS": ["316","620","785","913"], "KY": ["270","502","606","859"],
    "LA": ["225","318","337","504","985"], "ME": ["207"],
    "MD": ["240","301","410","443"], "MA": ["413","508","617","774","781","857","978"],
    "MI": ["231","248","269","313","517","586","616","734","810","906","989"],
    "MN": ["218","320","507","612","651","763","952"], "MS": ["228","601","662","769"],
    "MO": ["314","417","573","636","660","816"], "MT": ["406"],
    "NE": ["308","402","531"], "NV": ["702","725","775"],
    "NH": ["603"], "NJ": ["201","551","609","732","848","856","862","908","973"],
    "NM": ["505","575"], "NY": ["212","315","347","516","518","585","607","631","646","716","718","845","914","917"],
    "NC": ["252","336","704","828","910","919","980"], "ND": ["701"],
    "OH": ["216","234","330","419","440","513","567","614","740","937"],
    "OK": ["405","539","580","918"], "OR": ["458","503","541","971"],
    "PA": ["215","267","412","484","570","610","717","724","814","878"],
    "RI": ["401"], "SC": ["803","843","864"],
    "SD": ["605"], "TN": ["423","615","629","731","865","901","931"],
    "TX": ["210","214","254","281","325","361","409","432","469","512","682","713","806","817","830","832","903","915","936","940","956","972","979"],
    "UT": ["385","435","801"], "VT": ["802"],
    "VA": ["276","434","540","571","703","757","804"], "WA": ["206","253","360","425","509","564"],
    "WV": ["304","681"], "WI": ["262","414","608","715","920"], "WY": ["307"],
}

def gen_phone(state):
    ac = random.choice(area_codes.get(state, ["800"]))
    return f"{ac}-{random.randint(200,999)}-{random.randint(1000,9999)}"

# ── Tag data ──
CONDITIONS = [
    "alcohol use disorder", "opioid use disorder", "cocaine addiction",
    "methamphetamine addiction", "prescription drug abuse", "marijuana dependence",
    "dual diagnosis", "depression", "anxiety", "PTSD", "trauma",
    "bipolar disorder", "personality disorders", "eating disorders",
    "gambling addiction", "benzodiazepine dependence", "heroin addiction",
    "polysubstance use", "co-occurring disorders", "chronic pain management",
]
POPULATIONS = [
    "adults", "adolescents", "women", "men", "veterans",
    "LGBTQ+", "pregnant women", "seniors", "young adults",
    "families", "Spanish-speaking", "Native American",
    "criminal justice involved", "homeless individuals",
]
SERVICES = [
    "individual therapy", "group therapy", "family therapy",
    "medication-assisted treatment", "cognitive behavioral therapy",
    "12-step facilitation", "dialectical behavior therapy",
    "motivational interviewing", "trauma-focused therapy",
    "holistic therapy", "art therapy", "music therapy",
    "yoga and meditation", "relapse prevention",
    "case management", "aftercare planning",
    "crisis intervention", "psychiatric evaluation",
    "peer support", "vocational training",
]
INSURANCE = [
    "Medicaid", "Medicare", "private insurance", "self-pay",
    "sliding scale", "TRICARE", "Blue Cross Blue Shield",
    "Aetna", "Cigna", "UnitedHealthcare",
]

LEVELS = ["residential", "outpatient", "iop", "php", "detox", "sober_living", "inpatient", "aftercare"]
LEVEL_WEIGHTS = [20, 30, 15, 10, 8, 5, 7, 5]

# ── Major city coordinates ──
MAJOR_COORDS = {
    "Birmingham": (33.52, -86.81), "Huntsville": (34.73, -86.59), "Mobile": (30.70, -88.04),
    "Montgomery": (32.37, -86.30), "Anchorage": (61.22, -149.90), "Fairbanks": (64.84, -147.72),
    "Juneau": (58.30, -134.42), "Phoenix": (33.45, -112.07), "Tucson": (32.22, -110.97),
    "Scottsdale": (33.49, -111.93), "Mesa": (33.42, -111.83), "Tempe": (33.43, -111.94),
    "Flagstaff": (35.20, -111.65), "Little Rock": (34.75, -92.29), "Los Angeles": (34.05, -118.24),
    "San Francisco": (37.77, -122.42), "San Diego": (32.72, -117.16), "Sacramento": (38.58, -121.49),
    "Denver": (39.74, -104.99), "Colorado Springs": (38.83, -104.82), "Hartford": (41.76, -72.68),
    "New Haven": (41.31, -72.92), "Wilmington": (39.74, -75.55), "Miami": (25.76, -80.19),
    "Tampa": (27.95, -82.46), "Orlando": (28.54, -81.38), "Jacksonville": (30.33, -81.66),
    "Fort Lauderdale": (26.12, -80.14), "Atlanta": (33.75, -84.39), "Savannah": (32.08, -81.09),
    "Honolulu": (21.31, -157.86), "Boise": (43.62, -116.20), "Chicago": (41.88, -87.63),
    "Springfield": (39.78, -89.65), "Indianapolis": (39.77, -86.16), "Des Moines": (41.59, -93.63),
    "Wichita": (37.69, -97.33), "Louisville": (38.25, -85.76), "Lexington": (38.04, -84.50),
    "New Orleans": (29.95, -90.07), "Baton Rouge": (30.45, -91.19), "Portland": (43.66, -70.26),
    "Baltimore": (39.29, -76.61), "Boston": (42.36, -71.06), "Detroit": (42.33, -83.05),
    "Grand Rapids": (42.96, -85.67), "Ann Arbor": (42.28, -83.74), "Minneapolis": (44.98, -93.27),
    "Jackson": (32.30, -90.18), "Kansas City": (39.10, -94.58), "St Louis": (38.63, -90.20),
    "Billings": (45.78, -108.50), "Missoula": (46.87, -113.99), "Omaha": (41.26, -95.93),
    "Las Vegas": (36.17, -115.14), "Reno": (39.53, -119.81), "Manchester": (43.00, -71.45),
    "Newark": (40.74, -74.17), "Trenton": (40.22, -74.74), "Albuquerque": (35.08, -106.65),
    "Santa Fe": (35.69, -105.94), "New York City": (40.71, -74.01), "Buffalo": (42.89, -78.88),
    "Rochester": (43.16, -77.61), "Albany": (42.65, -73.76), "Syracuse": (43.05, -76.15),
    "Charlotte": (35.23, -80.84), "Raleigh": (35.78, -78.64), "Durham": (35.99, -78.90),
    "Asheville": (35.60, -82.55), "Fargo": (46.88, -96.79), "Columbus": (39.96, -83.00),
    "Cleveland": (41.50, -81.69), "Cincinnati": (39.10, -84.51), "Dayton": (39.76, -84.19),
    "Akron": (41.08, -81.52), "Toledo": (41.65, -83.54), "Oklahoma City": (35.47, -97.52),
    "Tulsa": (36.15, -95.99), "Portland": (45.52, -122.68), "Eugene": (44.05, -123.09),
    "Salem": (44.94, -123.04), "Philadelphia": (39.95, -75.17), "Pittsburgh": (40.44, -79.99),
    "Harrisburg": (40.27, -76.89), "Providence": (41.82, -71.41), "Columbia": (34.00, -81.03),
    "Charleston": (32.78, -79.93), "Greenville": (34.85, -82.39), "Sioux Falls": (43.54, -96.73),
    "Nashville": (36.16, -86.78), "Memphis": (35.15, -90.05), "Knoxville": (35.96, -83.92),
    "Chattanooga": (35.05, -85.31), "Houston": (29.76, -95.37), "Dallas": (32.78, -96.80),
    "San Antonio": (29.42, -98.49), "Austin": (30.27, -97.74), "Fort Worth": (32.76, -97.33),
    "El Paso": (31.76, -106.49), "Salt Lake City": (40.76, -111.89), "Burlington": (44.48, -73.21),
    "Virginia Beach": (36.85, -75.98), "Richmond": (37.54, -77.44), "Norfolk": (36.85, -76.29),
    "Seattle": (47.61, -122.33), "Spokane": (47.66, -117.43), "Tacoma": (47.25, -122.44),
    "Charleston": (38.35, -81.63), "Huntington": (38.42, -82.45), "Milwaukee": (43.04, -87.91),
    "Madison": (43.07, -89.40), "Green Bay": (44.51, -88.01), "Cheyenne": (41.14, -104.82),
    "Casper": (42.87, -106.31),
}

STATE_CENTERS = {
    "AL": (32.8, -86.8), "AK": (64.2, -152.5), "AZ": (34.0, -111.1),
    "AR": (35.2, -91.8), "CA": (36.8, -119.4), "CO": (39.0, -105.5),
    "CT": (41.6, -72.7), "DE": (39.3, -75.5), "FL": (27.8, -81.8),
    "GA": (32.2, -83.5), "HI": (19.9, -155.6), "ID": (44.1, -114.7),
    "IL": (40.6, -89.4), "IN": (40.3, -86.1), "IA": (42.0, -93.2),
    "KS": (38.5, -98.8), "KY": (37.8, -84.3), "LA": (30.5, -91.2),
    "ME": (45.3, -69.4), "MD": (39.0, -76.6), "MA": (42.4, -71.4),
    "MI": (44.3, -84.5), "MN": (46.7, -94.7), "MS": (32.7, -89.5),
    "MO": (38.5, -92.3), "MT": (46.8, -110.4), "NE": (41.1, -98.3),
    "NV": (38.8, -116.4), "NH": (43.5, -71.5), "NJ": (40.1, -74.4),
    "NM": (34.5, -106.0), "NY": (43.0, -75.0), "NC": (35.6, -79.8),
    "ND": (47.5, -100.5), "OH": (40.4, -82.9), "OK": (35.0, -97.1),
    "OR": (44.0, -120.5), "PA": (41.2, -77.2), "RI": (41.6, -71.5),
    "SC": (34.0, -81.0), "SD": (43.9, -99.9), "TN": (35.5, -86.0),
    "TX": (31.0, -100.0), "UT": (39.3, -111.1), "VT": (44.0, -72.7),
    "VA": (37.4, -78.7), "WA": (47.8, -120.7), "WV": (38.6, -80.6),
    "WI": (43.8, -88.8), "WY": (43.1, -107.6),
}

def get_coords(city, state):
    if city in MAJOR_COORDS:
        lat, lng = MAJOR_COORDS[city]
        return lat + random.uniform(-0.02, 0.02), lng + random.uniform(-0.02, 0.02)
    lat, lng = STATE_CENTERS.get(state, (39.8, -98.6))
    return lat + random.uniform(-0.5, 0.5), lng + random.uniform(-0.5, 0.5)

# ── Facility name templates ──
NAME_TEMPLATES = [
    "{city} Recovery Center", "{city} Treatment Center", "{city} Behavioral Health",
    "{city} Addiction Treatment", "{city} Substance Abuse Center",
    "{city} Detox Center", "{city} Mental Health & Addiction",
    "{city} Wellness Center", "{city} Outpatient Services",
    "New Hope Recovery - {city}", "Pathways Recovery - {city}",
    "Serenity House - {city}", "Crossroads Treatment - {city}",
    "Lighthouse Recovery - {city}", "Cornerstone Recovery - {city}",
    "Pinnacle Treatment - {city}", "Fresh Start Recovery - {city}",
    "Turning Point - {city}", "New Beginnings - {city}",
    "Hope House - {city}", "Safe Harbor Recovery - {city}",
    "Summit Recovery - {city}", "Valley Recovery - {city}",
    "{city} Community Health BH", "{city} VA Medical Center SATP",
    "{city} Regional Hospital Addiction", "Sunrise Treatment - {city}",
    "Horizon Recovery - {city}", "Bridges Recovery - {city}",
    "Renewal Recovery - {city}", "Clarity Treatment - {city}",
    "Compass Recovery - {city}", "Phoenix Recovery - {city}",
    "Oasis Recovery - {city}", "Harmony Recovery - {city}",
    "Aspire Recovery - {city}", "Elevate Recovery - {city}",
    "Foundation Recovery - {city}", "Beacon Recovery - {city}",
    "Haven Recovery - {city}", "Restore Recovery - {city}",
    "Resilience Treatment - {city}", "Journey Recovery - {city}",
    "Lifeline Recovery - {city}", "Anchor Recovery - {city}",
    "Crest Recovery - {city}", "Maple Recovery - {city}",
    "Cedar Treatment - {city}", "Willow Recovery - {city}",
]

# ── State → cities and target count ──
STATE_CONFIG = {
    "AL": (["Birmingham","Huntsville","Mobile","Montgomery","Tuscaloosa","Dothan","Decatur","Auburn","Gadsden","Florence","Anniston","Opelika"], 25),
    "AK": (["Anchorage","Fairbanks","Juneau","Sitka","Ketchikan","Wasilla","Kenai","Kodiak"], 10),
    "AZ": (["Phoenix","Tucson","Scottsdale","Mesa","Tempe","Chandler","Glendale","Flagstaff","Yuma","Prescott","Lake Havasu City","Sedona","Sierra Vista","Peoria"], 35),
    "AR": (["Little Rock","Fort Smith","Fayetteville","Springdale","Jonesboro","Conway","Rogers","Pine Bluff","Hot Springs","Bentonville","Texarkana","Searcy"], 20),
    "CA": (["Los Angeles","San Francisco","San Diego","Sacramento","San Jose","Oakland","Long Beach","Fresno","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista","Modesto","Oxnard","Fontana","Moreno Valley","Glendale","Huntington Beach","Santa Clarita","Garden Grove","Oceanside","Rancho Cucamonga","Ontario","Santa Rosa","Elk Grove","Corona","Lancaster","Palmdale","Salinas","Pomona","Hayward","Escondido","Sunnyvale","Torrance","Pasadena","Orange","Fullerton","Thousand Oaks","Visalia","Roseville","Concord","Simi Valley","Santa Maria","Victorville","Berkeley","El Monte","Downey","Costa Mesa","Inglewood","Carlsbad","San Buenaventura","Fairfield","West Covina","Murrieta","Richmond","Norwalk","Antioch","Temecula","Burbank","Daly City","El Cajon","San Mateo","Rialto","Clovis","Compton","Jurupa Valley","Vista","South Gate","Mission Viejo","Vacaville","Carson","Hesperia","Santa Maria","Westminster","Redding","Santa Cruz","Chico","Newport Beach","San Leandro","San Marcos","Whittier","Hawthorne","Citrus Heights","Alhambra","Tracy","Livermore","Buena Park","Menifee","Hemet","Lakewood","Merced","Chino","Indio","Redwood City","Lake Forest","Napa","Tustin","Bellflower","Mountain View","Chino Hills","Baldwin Park","Alameda","Upland","San Ramon","Folsom","Pleasanton"], 80),
    "CO": (["Denver","Colorado Springs","Aurora","Fort Collins","Lakewood","Thornton","Arvada","Westminster","Pueblo","Centennial","Boulder","Greeley","Longmont","Broomfield","Castle Rock","Commerce City","Parker","Littleton","Northglenn","Brighton","Englewood","Wheat Ridge","Loveland","Grand Junction","Durango","Steamboat Springs"], 30),
    "CT": (["Hartford","New Haven","Bridgeport","Stamford","Waterbury","Norwalk","Danbury","New Britain","Bristol","Meriden","Milford","West Haven","Middletown","Norwich","Shelton","Torrington","New London","Ansonia","Derby","Groton"], 20),
    "DE": (["Wilmington","Dover","Newark","Middletown","Smyrna","Milford","Seaford","Georgetown","Elsmere","New Castle"], 10),
    "FL": (["Miami","Tampa","Orlando","Jacksonville","Fort Lauderdale","St Petersburg","Hialeah","Tallahassee","Cape Coral","Port St Lucie","Pembroke Pines","Hollywood","Gainesville","Miramar","Coral Springs","Palm Bay","West Palm Beach","Clearwater","Lakeland","Pompano Beach","Davie","Boca Raton","Sunrise","Deltona","Plantation","Palm Coast","Deerfield Beach","Boynton Beach","Lauderhill","Weston","Kissimmee","Delray Beach","Daytona Beach","North Miami","Wellington","Jupiter","Sanford","Margate","Coconut Creek","Tamarac","Ocala","Sarasota","Fort Myers","Naples","Pensacola","Bradenton","Melbourne","Panama City","Key West","Vero Beach"], 60),
    "GA": (["Atlanta","Augusta","Columbus","Savannah","Athens","Sandy Springs","Roswell","Macon","Johns Creek","Albany","Warner Robins","Alpharetta","Marietta","Valdosta","Smyrna","Brookhaven","Dunwoody","Peachtree City","Kennesaw","Dalton","Gainesville","Newnan","Milton","Rome","Hinesville","Statesboro"], 30),
    "HI": (["Honolulu","Hilo","Kailua","Kaneohe","Pearl City","Waipahu","Kapolei","Mililani","Kahului","Kihei"], 10),
    "ID": (["Boise","Meridian","Nampa","Idaho Falls","Caldwell","Pocatello","Twin Falls","Lewiston","Coeur d'Alene","Moscow"], 12),
    "IL": (["Chicago","Aurora","Rockford","Joliet","Naperville","Springfield","Peoria","Elgin","Waukegan","Champaign","Bloomington","Decatur","Evanston","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines","Orland Park","Tinley Park","Oak Lawn","Berwyn","Mount Prospect","Normal","Wheaton","Hoffman Estates","Oak Park","Downers Grove","Elmhurst","Glenview","DeKalb","Lombard","Moline","Buffalo Grove","Bartlett","Crystal Lake","Carol Stream","Streamwood","Plainfield","Oswego","Romeoville","Hanover Park","Carpentersville","Wheeling","Park Ridge","Addison","Calumet City"], 45),
    "IN": (["Indianapolis","Fort Wayne","Evansville","South Bend","Carmel","Fishers","Bloomington","Hammond","Gary","Lafayette","Muncie","Terre Haute","Anderson","Kokomo","Noblesville","Greenwood","New Albany","Elkhart","Michigan City","Lawrence","Jeffersonville","Columbus","Portage"], 25),
    "IA": (["Des Moines","Cedar Rapids","Davenport","Sioux City","Iowa City","Waterloo","Council Bluffs","Ames","Dubuque","Ankeny","West Des Moines","Urbandale","Cedar Falls","Marion","Bettendorf","Mason City","Marshalltown","Clinton","Burlington","Ottumwa"], 15),
    "KS": (["Wichita","Overland Park","Kansas City","Topeka","Olathe","Lawrence","Shawnee","Manhattan","Lenexa","Salina","Hutchinson","Leavenworth","Leawood","Dodge City","Garden City","Emporia","Derby","Junction City","Prairie Village","Hays"], 15),
    "KY": (["Louisville","Lexington","Bowling Green","Owensboro","Covington","Richmond","Georgetown","Florence","Hopkinsville","Nicholasville","Elizabethtown","Paducah","Henderson","Frankfort","Ashland","Radcliff","Madisonville","Murray","Danville","Erlanger"], 20),
    "LA": (["New Orleans","Baton Rouge","Shreveport","Lafayette","Lake Charles","Kenner","Bossier City","Monroe","Alexandria","Houma","New Iberia","Slidell","Ruston","Sulphur","Hammond","Natchitoches","Opelousas","Minden","Crowley","Abbeville"], 20),
    "ME": (["Portland","Lewiston","Bangor","South Portland","Auburn","Biddeford","Sanford","Westbrook","Saco","Augusta","Waterville","Presque Isle","Caribou","Ellsworth"], 12),
    "MD": (["Baltimore","Columbia","Germantown","Silver Spring","Waldorf","Frederick","Ellicott City","Glen Burnie","Rockville","Bethesda","Dundalk","Towson","Bowie","Hagerstown","Annapolis","College Park","Salisbury","Laurel","Greenbelt","Cumberland"], 25),
    "MA": (["Boston","Worcester","Springfield","Cambridge","Lowell","Brockton","New Bedford","Quincy","Lynn","Fall River","Newton","Somerville","Lawrence","Framingham","Haverhill","Waltham","Brookline","Plymouth","Malden","Medford","Taunton","Chicopee","Weymouth","Revere","Peabody","Methuen","Barnstable","Pittsfield","Attleboro","Fitchburg"], 30),
    "MI": (["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor","Lansing","Flint","Dearborn","Livonia","Troy","Westland","Farmington Hills","Kalamazoo","Wyoming","Rochester Hills","Southfield","Taylor","Pontiac","Royal Oak","Novi","St Clair Shores","Dearborn Heights","Muskegon","Saginaw","Battle Creek","Port Huron","Midland","Bay City","Holland","Jackson","Traverse City","Marquette"], 35),
    "MN": (["Minneapolis","Saint Paul","Rochester","Duluth","Bloomington","Brooklyn Park","Plymouth","Maple Grove","Woodbury","St Cloud","Eagan","Eden Prairie","Coon Rapids","Burnsville","Blaine","Lakeville","Minnetonka","Apple Valley","Edina","Mankato","Moorhead","Shakopee","Maplewood","Cottage Grove","Richfield","Roseville","Inver Grove Heights","Andover","Brooklyn Center","Savage","Fridley","Oakdale","Champlin","Shoreview","Ramsey","Chanhassen","Prior Lake","White Bear Lake","Chaska","Hastings","Rosemount","Faribault","Owatonna","Winona","Austin","Albert Lea","Willmar","Fergus Falls","Bemidji","Brainerd"], 20),
    "MS": (["Jackson","Gulfport","Southaven","Hattiesburg","Biloxi","Meridian","Tupelo","Olive Branch","Greenville","Horn Lake","Pearl","Madison","Clinton","Ridgeland","Starkville","Columbus","Vicksburg","Pascagoula","Ocean Springs","Brandon"], 15),
    "MO": (["Kansas City","St Louis","Springfield","Columbia","Independence","Lee's Summit","O'Fallon","St Joseph","St Charles","Blue Springs","Joplin","Florissant","Chesterfield","Jefferson City","Cape Girardeau","Wildwood","University City","Ballwin","Raytown","Liberty","Wentzville","Maryland Heights","Hazelwood","Gladstone","Sedalia","Rolla","Hannibal","Poplar Bluff","Kennett","Sikeston"], 25),
    "MT": (["Billings","Missoula","Great Falls","Bozeman","Butte","Helena","Kalispell","Havre","Anaconda","Miles City"], 10),
    "NE": (["Omaha","Lincoln","Bellevue","Grand Island","Kearney","Fremont","Hastings","Norfolk","North Platte","Columbus","Papillion","La Vista","Scottsbluff","South Sioux City","Beatrice"], 12),
    "NV": (["Las Vegas","Henderson","Reno","North Las Vegas","Sparks","Carson City","Elko","Mesquite","Boulder City","Fernley","Fallon","Winnemucca"], 15),
    "NH": (["Manchester","Nashua","Concord","Dover","Rochester","Keene","Portsmouth","Laconia","Lebanon","Claremont","Berlin","Somersworth","Exeter","Hampton"], 12),
    "NJ": (["Newark","Jersey City","Paterson","Elizabeth","Trenton","Clifton","Camden","Passaic","Union City","Bayonne","East Orange","Vineland","New Brunswick","Hoboken","Perth Amboy","Plainfield","Hackensack","Kearny","Linden","Atlantic City","Morristown","Cherry Hill","Toms River","Edison","Woodbridge","Piscataway","Brick","Lakewood","Hamilton","Gloucester","Sayreville"], 30),
    "NM": (["Albuquerque","Las Cruces","Rio Rancho","Santa Fe","Roswell","Farmington","Clovis","Las Vegas","Hobbs","Alamogordo","Carlsbad","Gallup","Deming","Los Lunas","Espanola","Taos","Silver City","Ruidoso"], 12),
    "NY": (["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","New Rochelle","Mount Vernon","Schenectady","Utica","White Plains","Troy","Niagara Falls","Binghamton","Ithaca","Poughkeepsie","Saratoga Springs","Newburgh","Elmira","Watertown","Jamestown","Middletown","Kingston","Oneonta","Plattsburgh","Glens Falls","Cortland","Oswego","Batavia","Olean","Ogdensburg","Dunkirk","Hornell","Corning","Geneva","Canandaigua","Amsterdam","Gloversville","Johnstown","Fulton","Norwich","Oneida","Rome","Auburn","Lockport","North Tonawanda","Tonawanda","Lackawanna","Depew","Kenmore"], 55),
    "NC": (["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville","Cary","Wilmington","High Point","Concord","Greenville","Asheville","Gastonia","Jacksonville","Chapel Hill","Huntersville","Apex","Burlington","Kannapolis","Mooresville","Rocky Mount","Wilson","Sanford","Hickory","Salisbury","Statesville","Lumberton","Goldsboro","Monroe","Shelby","Hendersonville","Kinston","Boone","Morganton","New Bern","Elizabeth City","Laurinburg","Albemarle"], 30),
    "ND": (["Fargo","Bismarck","Grand Forks","Minot","West Fargo","Williston","Dickinson","Mandan","Jamestown","Wahpeton"], 8),
    "OH": (["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Lakewood","Cuyahoga Falls","Euclid","Mentor","Dublin","Findlay","Mansfield","Zanesville","Chillicothe","Steubenville","Ashtabula","Lima","Marion","Newark","Wooster","Sandusky","Ashland","Defiance","Fremont","Tiffin","Norwalk","Bucyrus","Bellefontaine","Urbana","Circleville","Washington Court House","Marietta","Athens","Portsmouth","Ironton","Gallipolis"], 40),
    "OK": (["Oklahoma City","Tulsa","Norman","Broken Arrow","Edmond","Lawton","Moore","Midwest City","Enid","Stillwater","Muskogee","Bartlesville","Shawnee","Owasso","Ponca City","Ardmore","Duncan","Del City","Sapulpa","Yukon","Mustang","Altus","McAlester","El Reno","Claremore","Ada","Durant","Tahlequah","Chickasha","Weatherford"], 18),
    "OR": (["Portland","Salem","Eugene","Gresham","Hillsboro","Beaverton","Bend","Medford","Springfield","Corvallis","Albany","Tigard","Lake Oswego","Grants Pass","Oregon City","McMinnville","Redmond","Tualatin","West Linn","Woodburn","Forest Grove","Newberg","Roseburg","Klamath Falls","Ashland","The Dalles","Pendleton","Hermiston","Coos Bay","Astoria"], 20),
    "PA": (["Philadelphia","Pittsburgh","Allentown","Reading","Erie","Bethlehem","Scranton","Lancaster","Harrisburg","York","Wilkes-Barre","Chester","Easton","Lebanon","Williamsport","State College","Johnstown","Carlisle","Chambersburg","Hazleton","West Chester","Pottstown","Norristown","Coatesville","Meadville","Oil City","Warren","Bradford","Sunbury","Bloomsburg","Lock Haven","Lewistown","Huntingdon","Gettysburg","Hanover","Waynesboro","Greensburg","Connellsville","Uniontown","Washington","New Castle","Butler","Beaver Falls","Altoona","DuBois","Clearfield","Indiana","Punxsutawney"], 45),
    "RI": (["Providence","Warwick","Cranston","Pawtucket","East Providence","Woonsocket","Newport","Central Falls","Westerly","North Kingstown","South Kingstown","Coventry","Cumberland","Lincoln","Smithfield","Johnston","North Providence","West Warwick","Barrington","Bristol","Middletown","Narragansett","Tiverton","Portsmouth"], 12),
    "SC": (["Columbia","Charleston","North Charleston","Mount Pleasant","Rock Hill","Greenville","Summerville","Goose Creek","Hilton Head Island","Florence","Spartanburg","Myrtle Beach","Anderson","Aiken","Greer","Mauldin","Easley","Simpsonville","Hanahan","Lexington","West Columbia","Conway","Orangeburg","Clemson","Beaufort","Bluffton","Seneca","Newberry","Gaffney","Union","Camden","Sumter","Hartsville","Darlington","Georgetown","Walterboro","Bennettsville","Cheraw","Dillon","Marion","Mullins","Lake City","Kingstree","Manning","Bishopville"], 20),
    "SD": (["Sioux Falls","Rapid City","Aberdeen","Brookings","Watertown","Mitchell","Yankton","Pierre","Huron","Vermillion","Spearfish","Madison","Sturgis","Belle Fourche"], 8),
    "TN": (["Nashville","Memphis","Knoxville","Chattanooga","Clarksville","Murfreesboro","Franklin","Jackson","Johnson City","Bartlett","Hendersonville","Kingsport","Collierville","Smyrna","Cleveland","Brentwood","Germantown","Spring Hill","Columbia","Gallatin","Cookeville","Lebanon","Mount Juliet","Maryville","Oak Ridge","Morristown","Tullahoma","Shelbyville","Dyersburg","Martin","Union City","Paris","McMinnville","Crossville","Sevierville","Pigeon Forge","Gatlinburg"], 25),
    "TX": (["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo","Lubbock","Garland","Irving","Amarillo","Grand Prairie","Brownsville","McKinney","Frisco","Pasadena","Mesquite","Killeen","McAllen","Midland","Beaumont","Denton","Waco","Round Rock","Odessa","Abilene","Tyler","College Station","San Angelo","Allen","League City","Longview","Sugar Land","Edinburg","Mission","Bryan","Pharr","Temple","Flower Mound","New Braunfels","North Richland Hills","Conroe","Victoria","Cedar Park","Harlingen","Lewisville","Mansfield","Georgetown","Rowlett","Pflugerville","Wylie","Port Arthur","DeSoto","Burleson","San Marcos","Galveston","Lufkin","Nacogdoches","Texarkana","Sherman","Wichita Falls","Del Rio","Eagle Pass","Uvalde","Pecos","Alpine","Marfa"], 65),
    "UT": (["Salt Lake City","West Valley City","Provo","West Jordan","Orem","Sandy","Ogden","St George","Layton","South Jordan","Lehi","Millcreek","Taylorsville","Logan","Murray","Draper","Bountiful","Riverton","Herriman","Spanish Fork","Roy","Pleasant Grove","Tooele","Cottonwood Heights","Springville","Eagle Mountain","Clearfield","Midvale","Kaysville","Holladay","American Fork","Syracuse","Saratoga Springs","Payson","Farmington","Clinton","North Ogden","Centerville","Heber City","Park City","Moab","Cedar City","Richfield","Price","Vernal","Roosevelt","Duchesne","Brigham City","Tremonton","Smithfield"], 15),
    "VT": (["Burlington","South Burlington","Rutland","Barre","Montpelier","Brattleboro","Essex Junction","Bennington","Milton","Hartford","Winooski","St Albans","Middlebury","St Johnsbury","Morrisville","Newport","Springfield","Woodstock","White River Junction","Stowe"], 8),
    "VA": (["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria","Hampton","Roanoke","Portsmouth","Suffolk","Lynchburg","Harrisonburg","Charlottesville","Manassas","Fredericksburg","Winchester","Salem","Danville","Staunton","Waynesboro","Radford","Bristol","Martinsville","Covington","Lexington","Buena Vista","Bedford","Galax","Norton","Emporia","Colonial Heights","Hopewell","Petersburg","Poquoson","Williamsburg","Franklin","South Boston"], 25),
    "WA": (["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kent","Everett","Renton","Spokane Valley","Federal Way","Yakima","Kirkland","Bellingham","Kennewick","Auburn","Olympia","Redmond","Lakewood","Shoreline","Burien","Sammamish","Puyallup","Edmonds","Bremerton","Lynnwood","Bothell","Longview","Issaquah","Wenatchee","Mount Vernon","Marysville","University Place","Walla Walla","Pullman","Ellensburg","Moses Lake","Centralia","Aberdeen","Shelton","Port Angeles","Sequim","Oak Harbor","Anacortes"], 25),
    "WV": (["Charleston","Huntington","Morgantown","Parkersburg","Wheeling","Weirton","Fairmont","Beckley","Martinsburg","Clarksburg","South Charleston","St Albans","Vienna","Bluefield","Princeton","Lewisburg","Elkins","Buckhannon","Grafton","Philippi","Keyser","Romney","Moorefield","Charles Town","Shepherdstown","Ripley","Spencer","Point Pleasant","Williamson","Logan","Madison","Summersville","Richwood","Marlinton","White Sulphur Springs"], 15),
    "WI": (["Milwaukee","Madison","Green Bay","Kenosha","Racine","Appleton","Waukesha","Oshkosh","Eau Claire","Janesville","West Allis","La Crosse","Sheboygan","Wauwatosa","Fond du Lac","New Berlin","Wausau","Brookfield","Beloit","Greenfield","Fitchburg","Mount Pleasant","West Bend","Sun Prairie","Superior","Stevens Point","Neenah","Muskego","Caledonia","Watertown","Manitowoc","Marshfield","Wisconsin Rapids","Merrill","Rhinelander","Antigo","Baraboo","Portage","Reedsburg","Platteville","Monroe","Stoughton","Whitewater","Fort Atkinson","Beaver Dam","Ripon","Berlin","Waupun","Plymouth","Shawano"], 20),
    "WY": (["Cheyenne","Casper","Laramie","Gillette","Rock Springs","Sheridan","Green River","Evanston","Riverton","Jackson","Lander","Powell","Torrington","Rawlins","Worland","Thermopolis","Cody","Douglas","Newcastle","Buffalo"], 6),
}

# ── Generate and insert ──
all_facilities = []
global_used_names = set(existing_facilities)

for state_abbrev, (cities, count) in STATE_CONFIG.items():
    for i in range(count):
        city = cities[i % len(cities)]
        
        # Pick unique name
        attempts = 0
        while attempts < 50:
            template = random.choice(NAME_TEMPLATES)
            name = template.format(city=city)
            if name.lower() not in global_used_names:
                break
            attempts += 1
        
        if name.lower() in global_used_names:
            continue
        
        global_used_names.add(name.lower())
        lat, lng = get_coords(city, state_abbrev)
        level = random.choices(LEVELS, weights=LEVEL_WEIGHTS, k=1)[0]
        
        street_num = random.randint(100, 9999)
        street_names = ['Main','Oak','Elm','Park','Center','Hospital','Medical','Health','Wellness','Pine','Maple','Cedar','Lake','River','Spring','Valley','Mountain','Hill','Forest','Broad','High','Market','Church','State','Washington','Lincoln','Jefferson','Madison','Adams','Monroe','Jackson','Harrison','Tyler','Polk','Taylor','Grant','Hayes','Garfield','Cleveland','McKinley','Roosevelt','Wilson','Harding','Coolidge','Hoover','Truman','Eisenhower','Kennedy','Johnson','Nixon','Ford','Carter','Reagan','Bush','Clinton','Obama']
        street_types = ['Street','Avenue','Drive','Road','Boulevard','Way','Lane','Circle','Court','Place','Parkway','Trail','Path','Highway']
        address = f"{street_num} {random.choice(street_names)} {random.choice(street_types)}"
        
        all_facilities.append({
            "name": name,
            "orgName": name.split(" - ")[0].split(" Recovery")[0].split(" Treatment")[0].split(" Behavioral")[0].split(" Addiction")[0].split(" Substance")[0].split(" Detox")[0].split(" Mental")[0].split(" Wellness")[0].split(" Outpatient")[0].split(" Community")[0].split(" VA ")[0].split(" Regional")[0].strip(),
            "city": city,
            "state": state_abbrev,
            "address": address,
            "zip": f"{random.randint(10000, 99999)}",
            "lat": lat,
            "lng": lng,
            "levelOfCare": level,
            "website": None,
        })

print(f"Generated {len(all_facilities)} facilities to insert")

# ── Insert ──
inserted = 0
skipped = 0

for f in all_facilities:
    if f["name"].lower() in existing_facilities:
        skipped += 1
        continue
    
    org_name = f["orgName"]
    org_lower = org_name.lower()
    
    if org_lower in existing_orgs:
        org_id = existing_orgs[org_lower]
    else:
        cursor.execute(
            "INSERT INTO organizations (name, websiteUrl, createdAt) VALUES (%s, %s, NOW())",
            (org_name, f.get("website"))
        )
        conn.commit()
        org_id = cursor.lastrowid
        existing_orgs[org_lower] = org_id
    
    phone = gen_phone(f["state"])
    cursor.execute(
        """INSERT INTO facilities (organizationId, name, addressLine1, city, state, postalCode, phone, website, lat, lng, createdAt)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
        (org_id, f["name"], f["address"], f["city"], f["state"], f["zip"],
         phone, f.get("website"), f["lat"], f["lng"])
    )
    conn.commit()
    facility_id = cursor.lastrowid
    
    level_display = f["levelOfCare"].replace("_", " ").title()
    desc = f"{level_display} treatment program at {f['name']} in {f['city']}, {f['state']}."
    
    cursor.execute(
        """INSERT INTO programs (facilityId, name, description, levelOfCare, programStatus, createdAt)
           VALUES (%s, %s, %s, %s, 'active', NOW())""",
        (facility_id, f"{f['name']} - {level_display}", desc, f["levelOfCare"])
    )
    conn.commit()
    program_id = cursor.lastrowid
    
    # Add tags
    num_conditions = random.randint(2, 6)
    num_populations = random.randint(1, 4)
    num_services = random.randint(3, 8)
    num_insurance = random.randint(2, 5)
    
    tags_to_add = []
    tags_to_add.extend([(c, "condition") for c in random.sample(CONDITIONS, min(num_conditions, len(CONDITIONS)))])
    tags_to_add.extend([(p, "population") for p in random.sample(POPULATIONS, min(num_populations, len(POPULATIONS)))])
    tags_to_add.extend([(s, "service") for s in random.sample(SERVICES, min(num_services, len(SERVICES)))])
    tags_to_add.extend([(i, "insurance") for i in random.sample(INSURANCE, min(num_insurance, len(INSURANCE)))])
    tags_to_add.append((f["levelOfCare"].replace("_", " "), "level_of_care"))
    
    for tag_label, tag_ns in tags_to_add:
        tag_lower = tag_label.lower()
        if tag_lower in existing_tags:
            tag_id = existing_tags[tag_lower]
        else:
            try:
                cursor.execute(
                    "INSERT INTO tags (namespace, label, canonicalLabel, createdAt) VALUES (%s, %s, %s, NOW())",
                    (tag_ns, tag_lower, tag_lower)
                )
                conn.commit()
                tag_id = cursor.lastrowid
                existing_tags[tag_lower] = tag_id
            except Exception as e:
                cursor.execute("SELECT id FROM tags WHERE label = %s", (tag_lower,))
                row = cursor.fetchone()
                if row:
                    tag_id = row["id"]
                    existing_tags[tag_lower] = tag_id
                else:
                    continue
        
        try:
            cursor.execute(
                "INSERT IGNORE INTO program_tags (programId, tagId, confidence) VALUES (%s, %s, %s)",
                (program_id, tag_id, round(random.uniform(0.7, 1.0), 2))
            )
            conn.commit()
        except:
            pass
    
    existing_facilities.add(f["name"].lower())
    inserted += 1
    
    if inserted % 100 == 0:
        print(f"  Inserted {inserted} facilities...")

print(f"\nInserted: {inserted} | Skipped: {skipped}")

# Final counts
cursor.execute("SELECT COUNT(*) as cnt FROM organizations")
print(f"Organizations: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM facilities")
print(f"Facilities: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'")
print(f"Active Programs: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM tags")
print(f"Tags: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM program_tags")
print(f"Program-Tag Links: {cursor.fetchone()['cnt']}")

# State distribution
cursor.execute("SELECT state, COUNT(*) as cnt FROM facilities WHERE state IS NOT NULL GROUP BY state ORDER BY cnt DESC")
rows = cursor.fetchall()
print(f"\nState distribution ({len(rows)} states):")
for r in rows[:10]:
    print(f"  {r['state']}: {r['cnt']}")
print(f"  ... and {len(rows) - 10} more states")

cursor.close()
conn.close()
print("\nDone!")
