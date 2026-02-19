#!/usr/bin/env python3
"""
Mass Treatment Facility Generator - Batch 2
Generates another 1000+ facilities with different naming patterns.
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

cursor.execute("SELECT LOWER(name) as n FROM facilities")
existing_facilities = set(r["n"] for r in cursor.fetchall())

cursor.execute("SELECT id, LOWER(name) as n FROM organizations")
existing_orgs = {r["n"]: r["id"] for r in cursor.fetchall()}

cursor.execute("SELECT id, LOWER(label) as lbl FROM tags")
existing_tags = {r["lbl"]: r["id"] for r in cursor.fetchall()}

print(f"Existing: {len(existing_facilities)} facilities, {len(existing_orgs)} orgs, {len(existing_tags)} tags")

area_codes = {
    "AL": ["205","251"], "AK": ["907"], "AZ": ["480","602"], "AR": ["501"],
    "CA": ["213","310","415","510","619","714","805","818","916","949"],
    "CO": ["303","719"], "CT": ["203","860"], "DE": ["302"],
    "FL": ["305","407","561","813","850","904","954"],
    "GA": ["404","678","770"], "HI": ["808"], "ID": ["208"],
    "IL": ["312","630","773","847"], "IN": ["317","574"],
    "IA": ["515","563"], "KS": ["316","913"], "KY": ["502","859"],
    "LA": ["504","225"], "ME": ["207"], "MD": ["301","410"],
    "MA": ["508","617","781"], "MI": ["313","616","734"],
    "MN": ["612","651"], "MS": ["601"], "MO": ["314","816"],
    "MT": ["406"], "NE": ["402"], "NV": ["702","775"],
    "NH": ["603"], "NJ": ["201","609","732","973"],
    "NM": ["505"], "NY": ["212","315","516","585","716","718","914"],
    "NC": ["704","919","336"], "ND": ["701"],
    "OH": ["216","330","513","614"], "OK": ["405","918"],
    "OR": ["503","541"], "PA": ["215","412","570","717"],
    "RI": ["401"], "SC": ["803","843"],
    "SD": ["605"], "TN": ["615","865","901"],
    "TX": ["210","214","512","713","817","832","903","915"],
    "UT": ["801","385"], "VT": ["802"],
    "VA": ["434","540","703","757"], "WA": ["206","253","509"],
    "WV": ["304"], "WI": ["414","608"], "WY": ["307"],
}

def gen_phone(state):
    ac = random.choice(area_codes.get(state, ["800"]))
    return f"{ac}-{random.randint(200,999)}-{random.randint(1000,9999)}"

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

MAJOR_COORDS = {
    "Birmingham": (33.52, -86.81), "Phoenix": (33.45, -112.07), "Tucson": (32.22, -110.97),
    "Los Angeles": (34.05, -118.24), "San Francisco": (37.77, -122.42), "San Diego": (32.72, -117.16),
    "Denver": (39.74, -104.99), "Miami": (25.76, -80.19), "Tampa": (27.95, -82.46),
    "Orlando": (28.54, -81.38), "Atlanta": (33.75, -84.39), "Chicago": (41.88, -87.63),
    "Indianapolis": (39.77, -86.16), "Boston": (42.36, -71.06), "Detroit": (42.33, -83.05),
    "Minneapolis": (44.98, -93.27), "Kansas City": (39.10, -94.58), "Las Vegas": (36.17, -115.14),
    "Newark": (40.74, -74.17), "New York City": (40.71, -74.01), "Charlotte": (35.23, -80.84),
    "Columbus": (39.96, -83.00), "Cleveland": (41.50, -81.69), "Cincinnati": (39.10, -84.51),
    "Portland": (45.52, -122.68), "Philadelphia": (39.95, -75.17), "Pittsburgh": (40.44, -79.99),
    "Nashville": (36.16, -86.78), "Memphis": (35.15, -90.05), "Houston": (29.76, -95.37),
    "Dallas": (32.78, -96.80), "San Antonio": (29.42, -98.49), "Austin": (30.27, -97.74),
    "Seattle": (47.61, -122.33), "Baltimore": (39.29, -76.61), "St Louis": (38.63, -90.20),
    "Sacramento": (38.58, -121.49), "Raleigh": (35.78, -78.64), "Jacksonville": (30.33, -81.66),
    "Salt Lake City": (40.76, -111.89), "Richmond": (37.54, -77.44), "Milwaukee": (43.04, -87.91),
    "New Orleans": (29.95, -90.07), "Oklahoma City": (35.47, -97.52), "Louisville": (38.25, -85.76),
    "Albuquerque": (35.08, -106.65), "Omaha": (41.26, -95.93), "Reno": (39.53, -119.81),
    "Buffalo": (42.89, -78.88), "Rochester": (43.16, -77.61), "Albany": (42.65, -73.76),
    "Fort Worth": (32.76, -97.33), "El Paso": (31.76, -106.49), "Spokane": (47.66, -117.43),
    "Honolulu": (21.31, -157.86), "Boise": (43.62, -116.20), "Anchorage": (61.22, -149.90),
}

def get_coords(city, state):
    if city in MAJOR_COORDS:
        lat, lng = MAJOR_COORDS[city]
        return lat + random.uniform(-0.03, 0.03), lng + random.uniform(-0.03, 0.03)
    lat, lng = STATE_CENTERS.get(state, (39.8, -98.6))
    return lat + random.uniform(-0.8, 0.8), lng + random.uniform(-0.8, 0.8)

# Batch 2 name templates - different patterns from batch 1
NAME_TEMPLATES_B2 = [
    "The {city} Center for Recovery", "Behavioral Health Associates of {city}",
    "{city} Counseling & Recovery", "Recovery Works - {city}",
    "Integrated Recovery Services - {city}", "{city} Comprehensive Treatment",
    "Mindful Recovery - {city}", "Pathfinder Treatment - {city}",
    "Evergreen Recovery - {city}", "Blue Ridge Recovery - {city}",
    "Cascade Recovery - {city}", "Prairie Recovery - {city}",
    "Coastal Recovery - {city}", "Mountain View Recovery - {city}",
    "Lakeview Recovery - {city}", "Riverside Treatment - {city}",
    "Parkside Recovery - {city}", "Westside Recovery - {city}",
    "Eastside Recovery - {city}", "Northside Recovery - {city}",
    "Southside Recovery - {city}", "Midtown Recovery - {city}",
    "Downtown Recovery - {city}", "Uptown Recovery - {city}",
    "Heritage Recovery - {city}", "Liberty Recovery - {city}",
    "Unity Recovery - {city}", "Serenity Springs - {city}",
    "Clearview Recovery - {city}", "Brightside Recovery - {city}",
    "Daybreak Recovery - {city}", "Starlight Recovery - {city}",
    "Moonrise Recovery - {city}", "Sunstone Recovery - {city}",
    "Redstone Recovery - {city}", "Bluestone Recovery - {city}",
    "Greenstone Recovery - {city}", "Goldstone Recovery - {city}",
    "Silverstone Recovery - {city}", "Ironstone Recovery - {city}",
    "Keystone Recovery - {city}", "Milestone Recovery - {city}",
    "Stepping Stone Recovery - {city}", "Cobblestone Recovery - {city}",
    "Cornerstone Behavioral - {city}", "Capstone Recovery - {city}",
    "Bridgeway Recovery - {city}", "Gateway Recovery - {city}",
    "Pathway Behavioral - {city}", "Crossway Recovery - {city}",
    "Fairway Recovery - {city}", "Hallway Recovery - {city}",
    "Archway Recovery - {city}", "Doorway Recovery - {city}",
    "Thresholds Recovery - {city}", "Connections Recovery - {city}",
    "Transformations Recovery - {city}", "Transitions Recovery - {city}",
    "Progressions Recovery - {city}", "Dimensions Recovery - {city}",
    "Perspectives Recovery - {city}", "Visions Recovery - {city}",
    "Horizons Recovery - {city}", "Futures Recovery - {city}",
    "Reflections Recovery - {city}", "Directions Recovery - {city}",
    "Solutions Recovery - {city}", "Alternatives Recovery - {city}",
    "Options Recovery - {city}", "Choices Recovery - {city}",
    "Decisions Recovery - {city}", "Answers Recovery - {city}",
    "Resources Recovery - {city}", "Services Recovery - {city}",
    "Alliance Recovery - {city}", "Coalition Recovery - {city}",
    "Network Recovery - {city}", "Partners Recovery - {city}",
    "Associates Recovery - {city}", "Collective Recovery - {city}",
    "Community Recovery - {city}", "Neighborhood Recovery - {city}",
    "Village Recovery - {city}", "Township Recovery - {city}",
    "County Recovery - {city}", "Regional Recovery - {city}",
    "Metropolitan Recovery - {city}", "Urban Recovery - {city}",
    "Suburban Recovery - {city}", "Rural Recovery - {city}",
]

STATE_CONFIG_B2 = {
    "AL": (["Birmingham","Huntsville","Mobile","Montgomery","Tuscaloosa","Dothan","Decatur","Auburn","Gadsden","Florence","Anniston","Opelika","Prattville","Phenix City","Vestavia Hills","Hoover","Homewood","Mountain Brook","Trussville","Pelham"], 20),
    "AK": (["Anchorage","Fairbanks","Juneau","Sitka","Ketchikan","Wasilla","Kenai","Kodiak","Palmer","Soldotna"], 6),
    "AZ": (["Phoenix","Tucson","Scottsdale","Mesa","Tempe","Chandler","Glendale","Flagstaff","Yuma","Prescott","Lake Havasu City","Sedona","Sierra Vista","Peoria","Surprise","Goodyear","Avondale","Buckeye","Maricopa","Casa Grande","Oro Valley","Marana","Sahuarita","Bullhead City","Kingman","Show Low","Payson","Cottonwood","Camp Verde","Globe"], 25),
    "AR": (["Little Rock","Fort Smith","Fayetteville","Springdale","Jonesboro","Conway","Rogers","Pine Bluff","Hot Springs","Bentonville","Texarkana","Searcy","Russellville","Paragould","Cabot","Jacksonville","Benton","Sherwood","Bryant","Maumelle"], 15),
    "CA": (["Los Angeles","San Francisco","San Diego","Sacramento","San Jose","Oakland","Long Beach","Fresno","Bakersfield","Anaheim","Santa Ana","Riverside","Stockton","Irvine","Chula Vista","Modesto","Oxnard","Fontana","Moreno Valley","Glendale","Huntington Beach","Santa Clarita","Garden Grove","Oceanside","Rancho Cucamonga","Ontario","Santa Rosa","Elk Grove","Corona","Lancaster","Palmdale","Salinas","Pomona","Hayward","Escondido","Sunnyvale","Torrance","Pasadena","Orange","Fullerton","Thousand Oaks","Visalia","Roseville","Concord","Simi Valley","Santa Maria","Victorville","Berkeley","El Monte","Downey","Costa Mesa","Inglewood","Carlsbad","San Buenaventura","Fairfield","West Covina","Murrieta","Richmond","Norwalk","Antioch","Temecula","Burbank","Daly City","El Cajon","San Mateo","Rialto","Clovis","Compton","Jurupa Valley","Vista","South Gate","Mission Viejo","Vacaville","Carson","Hesperia","Westminster","Redding","Santa Cruz","Chico","Newport Beach"], 60),
    "CO": (["Denver","Colorado Springs","Aurora","Fort Collins","Lakewood","Thornton","Arvada","Westminster","Pueblo","Centennial","Boulder","Greeley","Longmont","Broomfield","Castle Rock","Commerce City","Parker","Littleton","Northglenn","Brighton","Englewood","Wheat Ridge","Loveland","Grand Junction","Durango","Steamboat Springs","Aspen","Vail","Telluride","Estes Park"], 22),
    "CT": (["Hartford","New Haven","Bridgeport","Stamford","Waterbury","Norwalk","Danbury","New Britain","Bristol","Meriden","Milford","West Haven","Middletown","Norwich","Shelton","Torrington","New London","Ansonia","Derby","Groton"], 15),
    "DE": (["Wilmington","Dover","Newark","Middletown","Smyrna","Milford","Seaford","Georgetown","Elsmere","New Castle"], 7),
    "FL": (["Miami","Tampa","Orlando","Jacksonville","Fort Lauderdale","St Petersburg","Tallahassee","Cape Coral","Port St Lucie","Pembroke Pines","Hollywood","Gainesville","Miramar","Coral Springs","Palm Bay","West Palm Beach","Clearwater","Lakeland","Pompano Beach","Davie","Boca Raton","Sunrise","Deltona","Plantation","Palm Coast","Deerfield Beach","Boynton Beach","Weston","Kissimmee","Delray Beach","Daytona Beach","North Miami","Wellington","Jupiter","Sanford","Ocala","Sarasota","Fort Myers","Naples","Pensacola","Bradenton","Melbourne","Panama City","Key West","Vero Beach","Stuart","Destin","Crestview","Niceville","Navarre"], 45),
    "GA": (["Atlanta","Augusta","Columbus","Savannah","Athens","Sandy Springs","Roswell","Macon","Johns Creek","Albany","Warner Robins","Alpharetta","Marietta","Valdosta","Smyrna","Brookhaven","Dunwoody","Peachtree City","Kennesaw","Dalton","Gainesville","Newnan","Milton","Rome","Hinesville","Statesboro","Carrollton","Griffin","LaGrange","Thomasville"], 22),
    "HI": (["Honolulu","Hilo","Kailua","Kaneohe","Pearl City","Waipahu","Kapolei","Mililani","Kahului","Kihei"], 7),
    "ID": (["Boise","Meridian","Nampa","Idaho Falls","Caldwell","Pocatello","Twin Falls","Lewiston","Coeur d'Alene","Moscow"], 8),
    "IL": (["Chicago","Aurora","Rockford","Joliet","Naperville","Springfield","Peoria","Elgin","Waukegan","Champaign","Bloomington","Decatur","Evanston","Schaumburg","Bolingbrook","Palatine","Skokie","Des Plaines","Orland Park","Tinley Park","Oak Lawn","Berwyn","Mount Prospect","Normal","Wheaton","Hoffman Estates","Oak Park","Downers Grove","Elmhurst","Glenview","DeKalb","Lombard","Moline","Buffalo Grove","Bartlett","Crystal Lake","Carol Stream","Streamwood","Plainfield","Oswego"], 35),
    "IN": (["Indianapolis","Fort Wayne","Evansville","South Bend","Carmel","Fishers","Bloomington","Hammond","Gary","Lafayette","Muncie","Terre Haute","Anderson","Kokomo","Noblesville","Greenwood","New Albany","Elkhart","Michigan City","Lawrence"], 18),
    "IA": (["Des Moines","Cedar Rapids","Davenport","Sioux City","Iowa City","Waterloo","Council Bluffs","Ames","Dubuque","Ankeny","West Des Moines","Urbandale","Cedar Falls","Marion","Bettendorf"], 10),
    "KS": (["Wichita","Overland Park","Kansas City","Topeka","Olathe","Lawrence","Shawnee","Manhattan","Lenexa","Salina","Hutchinson","Leavenworth","Leawood","Dodge City","Garden City"], 10),
    "KY": (["Louisville","Lexington","Bowling Green","Owensboro","Covington","Richmond","Georgetown","Florence","Hopkinsville","Nicholasville","Elizabethtown","Paducah","Henderson","Frankfort","Ashland"], 14),
    "LA": (["New Orleans","Baton Rouge","Shreveport","Lafayette","Lake Charles","Kenner","Bossier City","Monroe","Alexandria","Houma","New Iberia","Slidell","Ruston","Sulphur","Hammond"], 14),
    "ME": (["Portland","Lewiston","Bangor","South Portland","Auburn","Biddeford","Sanford","Westbrook","Saco","Augusta"], 8),
    "MD": (["Baltimore","Columbia","Germantown","Silver Spring","Waldorf","Frederick","Ellicott City","Glen Burnie","Rockville","Bethesda","Dundalk","Towson","Bowie","Hagerstown","Annapolis"], 18),
    "MA": (["Boston","Worcester","Springfield","Cambridge","Lowell","Brockton","New Bedford","Quincy","Lynn","Fall River","Newton","Somerville","Lawrence","Framingham","Haverhill","Waltham","Brookline","Plymouth","Malden","Medford"], 22),
    "MI": (["Detroit","Grand Rapids","Warren","Sterling Heights","Ann Arbor","Lansing","Flint","Dearborn","Livonia","Troy","Westland","Farmington Hills","Kalamazoo","Wyoming","Rochester Hills","Southfield","Taylor","Pontiac","Royal Oak","Novi"], 25),
    "MN": (["Minneapolis","Saint Paul","Rochester","Duluth","Bloomington","Brooklyn Park","Plymouth","Maple Grove","Woodbury","St Cloud","Eagan","Eden Prairie","Coon Rapids","Burnsville","Blaine"], 14),
    "MS": (["Jackson","Gulfport","Southaven","Hattiesburg","Biloxi","Meridian","Tupelo","Olive Branch","Greenville","Horn Lake"], 10),
    "MO": (["Kansas City","St Louis","Springfield","Columbia","Independence","Lee's Summit","O'Fallon","St Joseph","St Charles","Blue Springs","Joplin","Florissant","Chesterfield","Jefferson City","Cape Girardeau"], 18),
    "MT": (["Billings","Missoula","Great Falls","Bozeman","Butte","Helena","Kalispell","Havre"], 6),
    "NE": (["Omaha","Lincoln","Bellevue","Grand Island","Kearney","Fremont","Hastings","Norfolk"], 8),
    "NV": (["Las Vegas","Henderson","Reno","North Las Vegas","Sparks","Carson City","Elko","Mesquite"], 10),
    "NH": (["Manchester","Nashua","Concord","Dover","Rochester","Keene","Portsmouth","Laconia"], 8),
    "NJ": (["Newark","Jersey City","Paterson","Elizabeth","Trenton","Clifton","Camden","Passaic","Union City","Bayonne","East Orange","Vineland","New Brunswick","Hoboken","Perth Amboy","Plainfield","Hackensack","Kearny","Linden","Atlantic City","Morristown","Cherry Hill","Toms River","Edison","Woodbridge"], 22),
    "NM": (["Albuquerque","Las Cruces","Rio Rancho","Santa Fe","Roswell","Farmington","Clovis","Las Vegas","Hobbs","Alamogordo"], 8),
    "NY": (["New York City","Buffalo","Rochester","Yonkers","Syracuse","Albany","New Rochelle","Mount Vernon","Schenectady","Utica","White Plains","Troy","Niagara Falls","Binghamton","Ithaca","Poughkeepsie","Saratoga Springs","Newburgh","Elmira","Watertown","Jamestown","Middletown","Kingston","Oneonta","Plattsburgh","Glens Falls","Cortland","Oswego","Batavia","Olean","Ogdensburg","Dunkirk","Hornell","Corning","Geneva","Canandaigua","Amsterdam","Rome","Auburn","Lockport"], 40),
    "NC": (["Charlotte","Raleigh","Greensboro","Durham","Winston-Salem","Fayetteville","Cary","Wilmington","High Point","Concord","Greenville","Asheville","Gastonia","Jacksonville","Chapel Hill","Huntersville","Apex","Burlington","Kannapolis","Mooresville"], 22),
    "ND": (["Fargo","Bismarck","Grand Forks","Minot","West Fargo","Williston","Dickinson","Mandan"], 5),
    "OH": (["Columbus","Cleveland","Cincinnati","Toledo","Akron","Dayton","Parma","Canton","Youngstown","Lorain","Hamilton","Springfield","Kettering","Elyria","Lakewood","Cuyahoga Falls","Euclid","Mentor","Dublin","Findlay","Mansfield","Zanesville","Chillicothe","Steubenville","Lima","Marion","Newark","Wooster","Sandusky"], 30),
    "OK": (["Oklahoma City","Tulsa","Norman","Broken Arrow","Edmond","Lawton","Moore","Midwest City","Enid","Stillwater","Muskogee","Bartlesville","Shawnee","Owasso","Ponca City"], 12),
    "OR": (["Portland","Salem","Eugene","Gresham","Hillsboro","Beaverton","Bend","Medford","Springfield","Corvallis","Albany","Tigard","Lake Oswego","Grants Pass","Oregon City"], 14),
    "PA": (["Philadelphia","Pittsburgh","Allentown","Reading","Erie","Bethlehem","Scranton","Lancaster","Harrisburg","York","Wilkes-Barre","Chester","Easton","Lebanon","Williamsport","State College","Johnstown","Carlisle","Chambersburg","Hazleton","West Chester","Pottstown","Norristown","Coatesville","Meadville","Altoona","DuBois","Clearfield","Indiana","Butler"], 35),
    "RI": (["Providence","Warwick","Cranston","Pawtucket","East Providence","Woonsocket","Newport","Central Falls"], 8),
    "SC": (["Columbia","Charleston","North Charleston","Mount Pleasant","Rock Hill","Greenville","Summerville","Goose Creek","Hilton Head Island","Florence","Spartanburg","Myrtle Beach","Anderson","Aiken","Greer"], 14),
    "SD": (["Sioux Falls","Rapid City","Aberdeen","Brookings","Watertown","Mitchell","Yankton","Pierre"], 5),
    "TN": (["Nashville","Memphis","Knoxville","Chattanooga","Clarksville","Murfreesboro","Franklin","Jackson","Johnson City","Bartlett","Hendersonville","Kingsport","Collierville","Smyrna","Cleveland"], 18),
    "TX": (["Houston","San Antonio","Dallas","Austin","Fort Worth","El Paso","Arlington","Corpus Christi","Plano","Laredo","Lubbock","Garland","Irving","Amarillo","Grand Prairie","Brownsville","McKinney","Frisco","Pasadena","Mesquite","Killeen","McAllen","Midland","Beaumont","Denton","Waco","Round Rock","Odessa","Abilene","Tyler","College Station","San Angelo","Allen","League City","Longview","Sugar Land","Edinburg","Mission","Bryan","Temple","New Braunfels","Conroe","Victoria","Cedar Park","Harlingen","Lewisville","Mansfield","Georgetown","Galveston","Lufkin"], 50),
    "UT": (["Salt Lake City","West Valley City","Provo","West Jordan","Orem","Sandy","Ogden","St George","Layton","South Jordan","Lehi","Logan","Murray","Draper","Bountiful"], 10),
    "VT": (["Burlington","South Burlington","Rutland","Barre","Montpelier","Brattleboro","Bennington","Milton"], 5),
    "VA": (["Virginia Beach","Norfolk","Chesapeake","Richmond","Newport News","Alexandria","Hampton","Roanoke","Portsmouth","Suffolk","Lynchburg","Harrisonburg","Charlottesville","Manassas","Fredericksburg","Winchester","Salem","Danville","Staunton","Waynesboro"], 18),
    "WA": (["Seattle","Spokane","Tacoma","Vancouver","Bellevue","Kent","Everett","Renton","Spokane Valley","Federal Way","Yakima","Kirkland","Bellingham","Kennewick","Auburn","Olympia","Redmond","Lakewood","Shoreline","Burien"], 18),
    "WV": (["Charleston","Huntington","Morgantown","Parkersburg","Wheeling","Weirton","Fairmont","Beckley","Martinsburg","Clarksburg"], 10),
    "WI": (["Milwaukee","Madison","Green Bay","Kenosha","Racine","Appleton","Waukesha","Oshkosh","Eau Claire","Janesville","West Allis","La Crosse","Sheboygan","Wauwatosa","Fond du Lac"], 14),
    "WY": (["Cheyenne","Casper","Laramie","Gillette","Rock Springs","Sheridan"], 4),
}

all_facilities = []
global_used_names = set(existing_facilities)

for state_abbrev, (cities, count) in STATE_CONFIG_B2.items():
    for i in range(count):
        city = cities[i % len(cities)]
        attempts = 0
        name = None
        while attempts < 80:
            template = random.choice(NAME_TEMPLATES_B2)
            name = template.format(city=city)
            if name.lower() not in global_used_names:
                break
            attempts += 1
        
        if name is None or name.lower() in global_used_names:
            continue
        
        global_used_names.add(name.lower())
        lat, lng = get_coords(city, state_abbrev)
        level = random.choices(LEVELS, weights=LEVEL_WEIGHTS, k=1)[0]
        
        street_num = random.randint(100, 9999)
        street_names = ['Main','Oak','Elm','Park','Center','Hospital','Medical','Health','Wellness','Pine','Maple','Cedar','Lake','River','Spring','Valley','Mountain','Hill','Forest','Broad','High','Market','Church','State']
        street_types = ['Street','Avenue','Drive','Road','Boulevard','Way','Lane','Circle','Court','Place']
        address = f"{street_num} {random.choice(street_names)} {random.choice(street_types)}"
        
        all_facilities.append({
            "name": name,
            "orgName": name.split(" - ")[0].split(" Center for")[0].split(" Associates of")[0].split(" Counseling")[0].strip(),
            "city": city,
            "state": state_abbrev,
            "address": address,
            "zip": f"{random.randint(10000, 99999)}",
            "lat": lat,
            "lng": lng,
            "levelOfCare": level,
        })

print(f"Generated {len(all_facilities)} new facilities for batch 2")

inserted = 0
for f in all_facilities:
    org_name = f["orgName"]
    org_lower = org_name.lower()
    
    if org_lower in existing_orgs:
        org_id = existing_orgs[org_lower]
    else:
        cursor.execute(
            "INSERT INTO organizations (name, createdAt) VALUES (%s, NOW())",
            (org_name,)
        )
        conn.commit()
        org_id = cursor.lastrowid
        existing_orgs[org_lower] = org_id
    
    phone = gen_phone(f["state"])
    cursor.execute(
        """INSERT INTO facilities (organizationId, name, addressLine1, city, state, postalCode, phone, lat, lng, createdAt)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())""",
        (org_id, f["name"], f["address"], f["city"], f["state"], f["zip"],
         phone, f["lat"], f["lng"])
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
            except:
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
    
    inserted += 1
    if inserted % 100 == 0:
        print(f"  Inserted {inserted}...")

print(f"\nBatch 2 inserted: {inserted}")

cursor.execute("SELECT COUNT(*) as cnt FROM organizations")
print(f"Total Organizations: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM facilities")
print(f"Total Facilities: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM programs WHERE programStatus = 'active'")
print(f"Total Active Programs: {cursor.fetchone()['cnt']}")
cursor.execute("SELECT COUNT(*) as cnt FROM program_tags")
print(f"Total Program-Tag Links: {cursor.fetchone()['cnt']}")

cursor.execute("SELECT state, COUNT(*) as cnt FROM facilities WHERE state IS NOT NULL GROUP BY state ORDER BY cnt DESC LIMIT 10")
for r in cursor.fetchall():
    print(f"  {r['state']}: {r['cnt']}")

cursor.close()
conn.close()
print("\nDone!")
