import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MapPin,
  Loader2,
  Building2,
  Phone,
  Video,
  ChevronRight,
  Navigation,
  AlertCircle,
  Star,
  Locate,
  Map as MapIcon,
  List,
} from "lucide-react";
import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { Link } from "wouter";
import { MapView } from "@/components/Map";
import {
  LEVEL_OF_CARE_OPTIONS,
  formatLevelOfCare,
  getConfidenceLabel,
} from "@shared/types";

type ViewMode = "list" | "map" | "split";

export default function NearbyPrograms() {
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [radiusMiles, setRadiusMiles] = useState(50);
  const [levelOfCare, setLevelOfCare] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);

  const queryInput = useMemo(
    () =>
      userLocation
        ? {
            lat: userLocation.lat,
            lng: userLocation.lng,
            radiusMiles,
            levelOfCare: levelOfCare.length > 0 ? levelOfCare : undefined,
            limit: 50,
          }
        : null,
    [userLocation, radiusMiles, levelOfCare]
  );

  const { data, isLoading } = trpc.nearby.programs.useQuery(queryInput!, {
    enabled: !!queryInput,
  });

  // Reverse geocode to get location name
  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!window.google) return;
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const components = results[0].address_components;
          const city = components.find((c) =>
            c.types.includes("locality")
          )?.long_name;
          const state = components.find((c) =>
            c.types.includes("administrative_area_level_1")
          )?.short_name;
          setLocationName([city, state].filter(Boolean).join(", ") || "Your Location");
        }
      });
    },
    []
  );

  // Get user's location via browser geolocation
  const requestLocation = useCallback(() => {
    setLocating(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(loc);
        setLocating(false);
        reverseGeocode(loc.lat, loc.lng);
      },
      (error) => {
        setLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError(
              "Location access denied. Please enable location permissions in your browser settings."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Location information is unavailable.");
            break;
          case error.TIMEOUT:
            setLocationError("Location request timed out. Please try again.");
            break;
          default:
            setLocationError("An unknown error occurred.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, [reverseGeocode]);

  // Use a default location (center of US) if user doesn't share location
  const useDefaultLocation = useCallback(() => {
    // Default to New York City
    const loc = { lat: 40.7128, lng: -74.006 };
    setUserLocation(loc);
    setLocationName("New York, NY (default)");
  }, []);

  // Update map markers when data changes
  useEffect(() => {
    if (!mapRef.current || !data) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Clear existing circle
    if (circleRef.current) {
      circleRef.current.setMap(null);
      circleRef.current = null;
    }

    const map = mapRef.current;

    // Add user location marker
    if (userLocation) {
      const userMarker = new google.maps.Marker({
        position: userLocation,
        map,
        title: "Your Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: "#3b82f6",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3,
        },
        zIndex: 1000,
      });
      markersRef.current.push(userMarker);

      // Add radius circle
      circleRef.current = new google.maps.Circle({
        map,
        center: userLocation,
        radius: radiusMiles * 1609.34, // Convert miles to meters
        fillColor: "#3b82f6",
        fillOpacity: 0.05,
        strokeColor: "#3b82f6",
        strokeOpacity: 0.3,
        strokeWeight: 1,
      });
    }

    // Add facility markers
    const bounds = new google.maps.LatLngBounds();
    if (userLocation) bounds.extend(userLocation);

    const infoWindow = new google.maps.InfoWindow();

    data.results.forEach((result) => {
      const fac = result.facility;
      if (!fac?.lat || !fac?.lng) return;

      const pos = {
        lat: parseFloat(String(fac.lat)),
        lng: parseFloat(String(fac.lng)),
      };
      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        map,
        title: fac.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#0d9488",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });

      marker.addListener("click", () => {
        infoWindow.setContent(
          `<div style="padding:6px;max-width:260px;">
            <strong style="font-size:14px;">${result.program.name}</strong>
            <div style="color:#666;font-size:12px;margin-top:4px;">
              ${fac.name}<br/>
              ${[fac.city, fac.state].filter(Boolean).join(", ")}
            </div>
            <div style="color:#0d9488;font-size:12px;margin-top:4px;font-weight:600;">
              ${result.distance} miles away
            </div>
            ${fac.phone ? `<a href="tel:${fac.phone}" style="color:#0d9488;font-size:12px;">${fac.phone}</a>` : ""}
          </div>`
        );
        infoWindow.open(map, marker);
      });

      markersRef.current.push(marker);
    });

    if (data.results.length > 0 || userLocation) {
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [data, userLocation, radiusMiles]);

  const toggleLoc = (value: string) => {
    setLevelOfCare((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-50 to-blue-50 border-b">
        <div className="container py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">
                Nearby Programs
              </h1>
              <p className="text-sm text-muted-foreground">
                Find treatment programs closest to you
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location & Controls */}
      <div className="bg-white border-b sticky top-16 z-40">
        <div className="container py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            {/* Location status */}
            <div className="flex items-center gap-3 flex-1">
              {userLocation ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {locationName || "Location set"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data?.total ?? 0} programs within {radiusMiles} miles
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={requestLocation}
                    className="ml-2"
                  >
                    <Locate className="w-3.5 h-3.5 mr-1" />
                    Update
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    onClick={requestLocation}
                    disabled={locating}
                    className="bg-teal-600 hover:bg-teal-700"
                  >
                    {locating ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Locate className="w-4 h-4 mr-2" />
                    )}
                    Use My Location
                  </Button>
                  <span className="text-sm text-muted-foreground">or</span>
                  <Button variant="outline" onClick={useDefaultLocation}>
                    Browse from New York
                  </Button>
                </div>
              )}
            </div>

            {/* Radius slider */}
            {userLocation && (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  Radius:
                </span>
                <Slider
                  value={[radiusMiles]}
                  onValueChange={([v]) => setRadiusMiles(v)}
                  min={5}
                  max={200}
                  step={5}
                  className="w-40"
                />
                <span className="text-sm font-medium w-16 text-right">
                  {radiusMiles} mi
                </span>
              </div>
            )}

            {/* View toggle */}
            {userLocation && (
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("split")}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "split" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Split
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "map" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <MapIcon className="w-3.5 h-3.5" /> Map
                </button>
              </div>
            )}
          </div>

          {/* Level of care filter */}
          {userLocation && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">
                Filter by level of care:
              </span>
              {LEVEL_OF_CARE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <Checkbox
                    checked={levelOfCare.includes(option.value)}
                    onCheckedChange={() => toggleLoc(option.value)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{option.label}</span>
                </label>
              ))}
            </div>
          )}

          {locationError && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-sm">{locationError}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      {!userLocation ? (
        <div className="container py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center mx-auto mb-6">
            <Navigation className="w-9 h-9 text-teal-600" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Share your location to find nearby programs
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            We'll show treatment programs sorted by distance from you, displayed
            on an interactive map. Your location is never stored.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={requestLocation}
              disabled={locating}
              size="lg"
              className="bg-teal-600 hover:bg-teal-700"
            >
              {locating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Locate className="w-4 h-4 mr-2" />
              )}
              Enable Location
            </Button>
            <Button variant="outline" size="lg" onClick={useDefaultLocation}>
              Browse from New York
            </Button>
          </div>
        </div>
      ) : (
        <div className="container py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600 mr-2" />
              <span className="text-muted-foreground">
                Finding nearby programs...
              </span>
            </div>
          )}

          {!isLoading && data && (
            <div
              className={`flex gap-4 ${viewMode === "split" ? "flex-col lg:flex-row" : ""}`}
            >
              {/* Map */}
              {(viewMode === "map" || viewMode === "split") && (
                <div
                  className={`rounded-xl border overflow-hidden ${viewMode === "split" ? "lg:w-1/2 h-[500px]" : "h-[600px]"}`}
                >
                  <MapView
                    initialCenter={userLocation}
                    initialZoom={9}
                    className="h-full"
                    onMapReady={(map) => {
                      mapRef.current = map;
                    }}
                  />
                </div>
              )}

              {/* List */}
              {(viewMode === "list" || viewMode === "split") && (
                <div
                  className={`${viewMode === "split" ? "lg:w-1/2 max-h-[500px] overflow-y-auto" : ""}`}
                >
                  {data.results.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <MapPin className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold text-lg text-foreground mb-2">
                        No programs found nearby
                      </h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Try increasing the search radius or removing level of
                        care filters. You can also{" "}
                        <Link
                          href="/search"
                          className="text-primary hover:underline"
                        >
                          search all programs
                        </Link>
                        .
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.results.map((result) => (
                        <NearbyProgramCard
                          key={result.program.id}
                          program={result.program}
                          facility={result.facility}
                          organization={result.organization}
                          distance={result.distance}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Nearby Program Card (with distance badge)
// ============================================================================

function NearbyProgramCard({
  program,
  facility,
  organization,
  distance,
}: {
  program: any;
  facility: any;
  organization: any;
  distance: number;
}) {
  const qualityScore = facility?.qualityScore ?? program?.qualityScore;

  return (
    <Link href={`/program/${program.id}`} className="block no-underline group">
      <Card className="hover:shadow-md hover:border-teal-300 transition-all">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge className="text-xs bg-teal-100 text-teal-800 hover:bg-teal-100 border-0">
                  <Navigation className="w-3 h-3 mr-1" />
                  {distance} mi
                </Badge>
                <Badge
                  variant="outline"
                  className="text-xs border-primary/30 text-primary"
                >
                  {formatLevelOfCare(program.levelOfCare)}
                </Badge>
                {program.telehealthAvailable && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Video className="w-3 h-3" /> Telehealth
                  </Badge>
                )}
                {qualityScore != null && qualityScore > 0 && (
                  <Badge
                    variant={qualityScore >= 0.7 ? "default" : "secondary"}
                    className="text-xs gap-1"
                  >
                    <Star className="w-3 h-3" />{" "}
                    {getConfidenceLabel(qualityScore)}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-teal-700 transition-colors line-clamp-1">
                {program.name}
              </h3>
              {organization && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />{" "}
                  {organization.name}
                </p>
              )}
              {facility && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />{" "}
                  {[facility.city, facility.state].filter(Boolean).join(", ")}
                </p>
              )}
              {program.description && (
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                  {program.description}
                </p>
              )}
              {facility?.phone && (
                <p className="text-sm text-teal-600 flex items-center gap-1 mt-1.5">
                  <Phone className="w-3.5 h-3.5" /> {facility.phone}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-teal-600 transition-colors shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
