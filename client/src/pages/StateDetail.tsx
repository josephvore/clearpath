import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MapPin,
  Building2,
  Phone,
  Video,
  Star,
  Shield,
  ChevronRight,
  Loader2,
  ArrowLeft,
  List,
  Map as MapIcon,
} from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useMemo } from "react";
import { MapView } from "@/components/Map";
import {
  LEVEL_OF_CARE_OPTIONS,
  US_STATES,
  formatLevelOfCare,
  getConfidenceLabel,
} from "@shared/types";

type ViewMode = "list" | "map";

export default function StateDetail() {
  const params = useParams<{ state: string }>();
  const stateCode = (params.state ?? "").toUpperCase();
  const stateName =
    US_STATES.find((s) => s.value === stateCode)?.label ?? stateCode;

  const [levelOfCare, setLevelOfCare] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      state: stateCode,
      levelOfCare: levelOfCare.length > 0 ? levelOfCare : undefined,
      limit: 20,
      offset: page * 20,
    }),
    [stateCode, levelOfCare, page]
  );

  const { data, isLoading } = trpc.browse.byState.useQuery(filters, {
    enabled: !!stateCode,
  });

  const toggleLevelOfCare = (value: string) => {
    setLevelOfCare((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPage(0);
  };

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white">
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
              <Link href="/browse">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{stateName}</h1>
              <p className="text-teal-100 text-sm">
                {data?.total ?? 0} treatment program{(data?.total ?? 0) !== 1 ? "s" : ""} available
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Sidebar filters */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24">
              <h3 className="text-sm font-semibold mb-3">Level of Care</h3>
              <div className="space-y-2">
                {LEVEL_OF_CARE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={levelOfCare.includes(option.value)}
                      onCheckedChange={() => toggleLevelOfCare(option.value)}
                    />
                    <span className="text-sm">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  "Loading..."
                ) : (
                  <>
                    <span className="font-medium text-foreground">{data?.total ?? 0}</span> program
                    {(data?.total ?? 0) !== 1 ? "s" : ""}
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === "list"
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-4 h-4" /> List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === "map"
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapIcon className="w-4 h-4" /> Map
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Loading programs...</span>
              </div>
            )}

            {!isLoading && data && (
              <>
                {viewMode === "list" ? (
                  <div className="space-y-4">
                    {data.results.length === 0 ? (
                      <div className="text-center py-16 text-muted-foreground">
                        No programs found for this state with the selected filters.
                      </div>
                    ) : (
                      data.results.map((result: any) => (
                        <ProgramCard
                          key={result.program.id}
                          program={result.program}
                          facility={result.facility}
                          organization={result.organization}
                        />
                      ))
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden h-[500px]">
                    <MapView
                      onMapReady={(map) => {
                        const facs = data.facilities ?? [];
                        if (facs.length === 0) {
                          map.setCenter({ lat: 39.8283, lng: -98.5795 });
                          map.setZoom(4);
                          return;
                        }
                        const bounds = new google.maps.LatLngBounds();
                        facs.forEach((f: any) => {
                          if (f.lat && f.lng) {
                            const pos = {
                              lat: parseFloat(String(f.lat)),
                              lng: parseFloat(String(f.lng)),
                            };
                            bounds.extend(pos);
                            const marker = new google.maps.Marker({
                              position: pos,
                              map,
                              title: f.name,
                              icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 8,
                                fillColor: "#0d9488",
                                fillOpacity: 0.9,
                                strokeColor: "#ffffff",
                                strokeWeight: 2,
                              },
                            });
                            const infoWindow = new google.maps.InfoWindow({
                              content: `<div style="padding:4px;max-width:220px;"><strong>${f.name}</strong><br/><span style="color:#666;font-size:12px;">${f.city ?? ""}, ${f.state ?? ""}</span>${f.phone ? `<br/><a href="tel:${f.phone}" style="color:#0d9488;font-size:12px;">${f.phone}</a>` : ""}</div>`,
                            });
                            marker.addListener("click", () =>
                              infoWindow.open(map, marker)
                            );
                          }
                        });
                        if (facs.length > 0) map.fitBounds(bounds);
                      }}
                    />
                  </div>
                )}

                {totalPages > 1 && viewMode === "list" && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-3">
                      Page {page + 1} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgramCard({
  program,
  facility,
  organization,
}: {
  program: any;
  facility: any;
  organization: any;
}) {
  const qualityScore = facility?.qualityScore ?? program?.qualityScore;
  const insuranceList: string[] = facility?.acceptedInsurance ?? [];

  return (
    <Link href={`/program/${program.id}`} className="block no-underline group">
      <Card className="hover:shadow-md hover:border-primary/30 transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 border-primary/30 text-primary"
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
                    <Star className="w-3 h-3" /> {getConfidenceLabel(qualityScore)} Quality
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {program.name}
              </h3>
              {organization && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" /> {organization.name}
                </p>
              )}
              {facility && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />{" "}
                  {[facility.city, facility.state].filter(Boolean).join(", ")}
                </p>
              )}
              {program.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {program.description}
                </p>
              )}

              {insuranceList.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {insuranceList.slice(0, 3).map((ins: string) => (
                    <Badge
                      key={ins}
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-green-300 text-green-700"
                    >
                      <Shield className="w-2.5 h-2.5 mr-0.5" /> {ins}
                    </Badge>
                  ))}
                  {insuranceList.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      +{insuranceList.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              {facility?.phone && (
                <p className="text-sm text-primary flex items-center gap-1 mt-2">
                  <Phone className="w-3.5 h-3.5" /> {facility.phone}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
