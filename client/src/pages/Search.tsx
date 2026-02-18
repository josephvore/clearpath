import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search as SearchIcon,
  MapPin,
  Filter,
  Loader2,
  Building2,
  Phone,
  Video,
  ChevronRight,
  Map as MapIcon,
  List,
  X,
  AlertCircle,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { MapView } from "@/components/Map";
import {
  LEVEL_OF_CARE_OPTIONS,
  PAYMENT_OPTIONS,
  US_STATES,
  formatLevelOfCare,
} from "@shared/types";

type ViewMode = "list" | "map";

export default function Search() {
  const searchParams = new URLSearchParams(useSearch());
  const initialQuery = searchParams.get("q") ?? "";
  const initialLoc = searchParams.get("levelOfCare");

  const [query, setQuery] = useState(initialQuery);
  const [levelOfCare, setLevelOfCare] = useState<string[]>(
    initialLoc ? [initialLoc] : []
  );
  const [state, setState] = useState("");
  const [telehealth, setTelehealth] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      query: query || undefined,
      levelOfCare: levelOfCare.length > 0 ? levelOfCare : undefined,
      state: state || undefined,
      telehealth: telehealth || undefined,
      paymentOptions: paymentOptions.length > 0 ? paymentOptions : undefined,
      limit: 20,
      offset: page * 20,
    }),
    [query, levelOfCare, state, telehealth, paymentOptions, page]
  );

  const { data, isLoading, error } = trpc.search.programs.useQuery(filters);
  const { data: mapFacilities } = trpc.map.facilities.useQuery(
    state ? { state } : undefined
  );

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setPage(0);
    },
    []
  );

  const toggleLevelOfCare = (value: string) => {
    setLevelOfCare((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPage(0);
  };

  const togglePayment = (value: string) => {
    setPaymentOptions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
    setPage(0);
  };

  const clearFilters = () => {
    setQuery("");
    setLevelOfCare([]);
    setState("");
    setTelehealth(false);
    setPaymentOptions([]);
    setPage(0);
  };

  const hasFilters =
    query || levelOfCare.length > 0 || state || telehealth || paymentOptions.length > 0;

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Search Header */}
      <div className="bg-white border-b">
        <div className="container py-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search programs, facilities, conditions..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-10 bg-white"
              />
            </div>
            <Select value={state} onValueChange={(v) => { setState(v === "all" ? "" : v); setPage(0); }}>
              <SelectTrigger className="w-[140px] h-10">
                <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mobile filter button */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 lg:hidden">
                  <Filter className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <FilterPanel
                  levelOfCare={levelOfCare}
                  telehealth={telehealth}
                  paymentOptions={paymentOptions}
                  toggleLevelOfCare={toggleLevelOfCare}
                  setTelehealth={setTelehealth}
                  togglePayment={togglePayment}
                />
              </SheetContent>
            </Sheet>

            <Button type="submit" className="h-10">
              Search
            </Button>
          </form>

          {/* Active filters */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {levelOfCare.map((loc) => (
                <Badge
                  key={loc}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => toggleLevelOfCare(loc)}
                >
                  {formatLevelOfCare(loc)}
                  <X className="w-3 h-3" />
                </Badge>
              ))}
              {telehealth && (
                <Badge
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => setTelehealth(false)}
                >
                  Telehealth <X className="w-3 h-3" />
                </Badge>
              )}
              {paymentOptions.map((po) => (
                <Badge
                  key={po}
                  variant="secondary"
                  className="gap-1 cursor-pointer"
                  onClick={() => togglePayment(po)}
                >
                  {po.replace(/_/g, " ")} <X className="w-3 h-3" />
                </Badge>
              ))}
              <button
                onClick={clearFilters}
                className="text-xs text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="container py-6">
        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <FilterPanel
                levelOfCare={levelOfCare}
                telehealth={telehealth}
                paymentOptions={paymentOptions}
                toggleLevelOfCare={toggleLevelOfCare}
                setTelehealth={setTelehealth}
                togglePayment={togglePayment}
              />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? (
                  "Searching..."
                ) : data ? (
                  <>
                    <span className="font-medium text-foreground">{data.total}</span>{" "}
                    program{data.total !== 1 ? "s" : ""} found
                  </>
                ) : null}
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
                  <List className="w-4 h-4" />
                  List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    viewMode === "map"
                      ? "bg-white shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MapIcon className="w-4 h-4" />
                  Map
                </button>
              </div>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Searching programs...</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">Failed to load results. Please try again.</p>
              </div>
            )}

            {/* Results */}
            {!isLoading && data && (
              <>
                {viewMode === "list" ? (
                  <div className="space-y-4">
                    {data.results.length === 0 ? (
                      <EmptyState />
                    ) : (
                      data.results.map((result) => (
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
                        if (!mapFacilities || mapFacilities.length === 0) {
                          map.setCenter({ lat: 39.8283, lng: -98.5795 });
                          map.setZoom(4);
                          return;
                        }

                        const bounds = new google.maps.LatLngBounds();
                        mapFacilities.forEach((f) => {
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
                              content: `<div style="padding:4px;max-width:200px;"><strong>${f.name}</strong><br/><span style="color:#666;font-size:12px;">${f.city ?? ""}, ${f.state ?? ""}</span></div>`,
                            });

                            marker.addListener("click", () => {
                              infoWindow.open(map, marker);
                            });
                          }
                        });

                        if (mapFacilities.length > 0) {
                          map.fitBounds(bounds);
                        }
                      }}
                    />
                  </div>
                )}

                {/* Pagination */}
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

// ============================================================================
// Filter Panel
// ============================================================================

function FilterPanel({
  levelOfCare,
  telehealth,
  paymentOptions,
  toggleLevelOfCare,
  setTelehealth,
  togglePayment,
}: {
  levelOfCare: string[];
  telehealth: boolean;
  paymentOptions: string[];
  toggleLevelOfCare: (v: string) => void;
  setTelehealth: (v: boolean) => void;
  togglePayment: (v: string) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Level of Care */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Level of Care</h3>
        <div className="space-y-2">
          {LEVEL_OF_CARE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={levelOfCare.includes(option.value)}
                onCheckedChange={() => toggleLevelOfCare(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Telehealth */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={telehealth}
            onCheckedChange={(checked) => setTelehealth(checked === true)}
          />
          <Video className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Telehealth Available</span>
        </label>
      </div>

      <Separator />

      {/* Payment Options */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Payment / Insurance</h3>
        <div className="space-y-2">
          {PAYMENT_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                checked={paymentOptions.includes(option.value)}
                onCheckedChange={() => togglePayment(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Program Card
// ============================================================================

function ProgramCard({
  program,
  facility,
  organization,
}: {
  program: any;
  facility: any;
  organization: any;
}) {
  return (
    <Link href={`/program/${program.id}`} className="block no-underline group">
      <Card className="hover:shadow-md hover:border-primary/30 transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className="text-xs shrink-0 border-primary/30 text-primary"
                >
                  {formatLevelOfCare(program.levelOfCare)}
                </Badge>
                {program.telehealthAvailable && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Video className="w-3 h-3" />
                    Telehealth
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                {program.name}
              </h3>
              {organization && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  {organization.name}
                </p>
              )}
              {facility && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {[facility.city, facility.state].filter(Boolean).join(", ")}
                </p>
              )}
              {program.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {program.description}
                </p>
              )}
              {facility?.phoneIntake && (
                <p className="text-sm text-primary flex items-center gap-1 mt-2">
                  <Phone className="w-3.5 h-3.5" />
                  {facility.phoneIntake}
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

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <SearchIcon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg text-foreground mb-2">No programs found</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Try adjusting your search terms or filters. You can also use the{" "}
        <Link href="/find" className="text-primary hover:underline">
          Guided Finder
        </Link>{" "}
        for personalized recommendations.
      </p>
    </div>
  );
}
