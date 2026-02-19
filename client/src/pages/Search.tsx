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
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Shield,
  Star,
  Bookmark,
  BookmarkCheck,
  GitCompareArrows,
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapView } from "@/components/Map";
import {
  LEVEL_OF_CARE_OPTIONS,
  PAYMENT_OPTIONS,
  US_STATES,
  COMMON_INSURANCE,
  COMMON_SUBSTANCES,
  COMMON_SPECIALIZATIONS,
  GENDER_POLICY_OPTIONS,
  formatLevelOfCare,
  getConfidenceLabel,
} from "@shared/types";

type ViewMode = "list" | "map";

export default function Search() {
  const searchParams = new URLSearchParams(useSearch());
  const initialQuery = searchParams.get("q") ?? "";
  const initialLoc = searchParams.get("levelOfCare");
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const toggleCompare = (id: number) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const [query, setQuery] = useState(initialQuery);
  const [levelOfCare, setLevelOfCare] = useState<string[]>(initialLoc ? [initialLoc] : []);
  const [state, setState] = useState("");
  const [telehealth, setTelehealth] = useState(false);
  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
  const [insurance, setInsurance] = useState<string[]>([]);
  const [substances, setSubstances] = useState<string[]>([]);
  const [genderPolicy, setGenderPolicy] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(0);

  const filters = useMemo(
    () => ({
      query: query || undefined,
      levelOfCare: levelOfCare.length > 0 ? levelOfCare : undefined,
      state: state || undefined,
      telehealth: telehealth || undefined,
      paymentOptions: paymentOptions.length > 0 ? paymentOptions : undefined,
      insurance: insurance.length > 0 ? insurance : undefined,
      substances: substances.length > 0 ? substances : undefined,
      genderPolicy: genderPolicy || undefined,
      limit: 20,
      offset: page * 20,
    }),
    [query, levelOfCare, state, telehealth, paymentOptions, insurance, substances, genderPolicy, page]
  );

  const { data, isLoading, error } = trpc.search.programs.useQuery(filters);
  const { data: mapFacilities } = trpc.map.facilities.useQuery(state ? { state } : undefined);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
  }, []);

  const toggleArray = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    setPage(0);
  };

  const clearFilters = () => {
    setQuery("");
    setLevelOfCare([]);
    setState("");
    setTelehealth(false);
    setPaymentOptions([]);
    setInsurance([]);
    setSubstances([]);
    setGenderPolicy("");
    setPage(0);
  };

  const hasFilters =
    query || levelOfCare.length > 0 || state || telehealth || paymentOptions.length > 0 || insurance.length > 0 || substances.length > 0 || genderPolicy;

  const totalPages = data ? Math.ceil(data.total / 20) : 0;

  const filterProps = {
    levelOfCare, telehealth, paymentOptions, insurance, substances, genderPolicy,
    toggleLevelOfCare: (v: string) => toggleArray(setLevelOfCare, v),
    setTelehealth,
    togglePayment: (v: string) => toggleArray(setPaymentOptions, v),
    toggleInsurance: (v: string) => toggleArray(setInsurance, v),
    toggleSubstance: (v: string) => toggleArray(setSubstances, v),
    setGenderPolicy,
  };

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
              <SelectTrigger className="w-[160px] h-10">
                <MapPin className="w-3.5 h-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {US_STATES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 lg:hidden">
                  <Filter className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <FilterPanel {...filterProps} />
              </SheetContent>
            </Sheet>

            <Button type="submit" className="h-10">Search</Button>
          </form>

          {/* Active filters */}
          {hasFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">Filters:</span>
              {levelOfCare.map((loc) => (
                <Badge key={loc} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleArray(setLevelOfCare, loc)}>
                  {formatLevelOfCare(loc)} <X className="w-3 h-3" />
                </Badge>
              ))}
              {telehealth && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setTelehealth(false)}>
                  Telehealth <X className="w-3 h-3" />
                </Badge>
              )}
              {insurance.map((ins) => (
                <Badge key={ins} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleArray(setInsurance, ins)}>
                  {ins} <X className="w-3 h-3" />
                </Badge>
              ))}
              {substances.map((sub) => (
                <Badge key={sub} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleArray(setSubstances, sub)}>
                  {sub} <X className="w-3 h-3" />
                </Badge>
              ))}
              {genderPolicy && (
                <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setGenderPolicy("")}>
                  {GENDER_POLICY_OPTIONS.find(g => g.value === genderPolicy)?.label ?? genderPolicy} <X className="w-3 h-3" />
                </Badge>
              )}
              {paymentOptions.map((po) => (
                <Badge key={po} variant="secondary" className="gap-1 cursor-pointer" onClick={() => toggleArray(setPaymentOptions, po)}>
                  {po.replace(/_/g, " ")} <X className="w-3 h-3" />
                </Badge>
              ))}
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear all</button>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="container py-6">
        <div className="flex gap-6">
          {/* Desktop sidebar filters */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto pr-2">
              <FilterPanel {...filterProps} />
            </div>
          </aside>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {compareIds.length > 0 && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <GitCompareArrows className="w-4 h-4 text-primary" />
                <span className="text-sm">
                  {compareIds.length} program{compareIds.length !== 1 ? "s" : ""} selected
                </span>
                {compareIds.length >= 2 && (
                  <Button size="sm" onClick={() => navigate(`/compare?ids=${compareIds.join(",")}`)}>
                    Compare Now
                  </Button>
                )}
                <button className="text-xs text-muted-foreground hover:text-foreground ml-auto" onClick={() => setCompareIds([])}>
                  Clear
                </button>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {isLoading ? "Searching..." : data ? (
                  <><span className="font-medium text-foreground">{data.total}</span> program{data.total !== 1 ? "s" : ""} found</>
                ) : null}
              </div>
              <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "list" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <List className="w-4 h-4" /> List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === "map" ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <MapIcon className="w-4 h-4" /> Map
                </button>
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Searching programs...</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-4 bg-destructive/10 text-destructive rounded-lg">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">Failed to load results. Please try again.</p>
              </div>
            )}

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
                          isCompareSelected={compareIds.includes(result.program.id)}
                          onToggleCompare={() => toggleCompare(result.program.id)}
                          showActions={true}
                          userId={user?.id}
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
                            const pos = { lat: parseFloat(String(f.lat)), lng: parseFloat(String(f.lng)) };
                            bounds.extend(pos);
                            const marker = new google.maps.Marker({
                              position: pos, map, title: f.name,
                              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#0d9488", fillOpacity: 0.9, strokeColor: "#ffffff", strokeWeight: 2 },
                            });
                            const infoWindow = new google.maps.InfoWindow({
                              content: `<div style="padding:4px;max-width:220px;"><strong>${f.name}</strong><br/><span style="color:#666;font-size:12px;">${f.city ?? ""}, ${f.state ?? ""}</span>${f.phone ? `<br/><a href="tel:${f.phone}" style="color:#0d9488;font-size:12px;">${f.phone}</a>` : ""}</div>`,
                            });
                            marker.addListener("click", () => infoWindow.open(map, marker));
                          }
                        });
                        if (mapFacilities.length > 0) map.fitBounds(bounds);
                      }}
                    />
                  </div>
                )}

                {totalPages > 1 && viewMode === "list" && (
                  <div className="flex items-center justify-center gap-2 mt-8">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                    <span className="text-sm text-muted-foreground px-3">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
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
// Filter Panel (enriched)
// ============================================================================

function FilterPanel({
  levelOfCare, telehealth, paymentOptions, insurance, substances, genderPolicy,
  toggleLevelOfCare, setTelehealth, togglePayment, toggleInsurance, toggleSubstance, setGenderPolicy,
}: {
  levelOfCare: string[];
  telehealth: boolean;
  paymentOptions: string[];
  insurance: string[];
  substances: string[];
  genderPolicy: string;
  toggleLevelOfCare: (v: string) => void;
  setTelehealth: (v: boolean) => void;
  togglePayment: (v: string) => void;
  toggleInsurance: (v: string) => void;
  toggleSubstance: (v: string) => void;
  setGenderPolicy: (v: string) => void;
}) {
  return (
    <Accordion type="multiple" defaultValue={["loc", "telehealth", "insurance"]} className="w-full">
      <AccordionItem value="loc">
        <AccordionTrigger className="text-sm font-semibold py-3">Level of Care</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {LEVEL_OF_CARE_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={levelOfCare.includes(option.value)} onCheckedChange={() => toggleLevelOfCare(option.value)} />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="telehealth">
        <AccordionTrigger className="text-sm font-semibold py-3">Telehealth</AccordionTrigger>
        <AccordionContent>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={telehealth} onCheckedChange={(checked) => setTelehealth(checked === true)} />
            <Video className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">Telehealth Available</span>
          </label>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="insurance">
        <AccordionTrigger className="text-sm font-semibold py-3">Insurance Accepted</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {COMMON_INSURANCE.map((ins) => (
              <label key={ins} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={insurance.includes(ins)} onCheckedChange={() => toggleInsurance(ins)} />
                <span className="text-sm">{ins}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="substances">
        <AccordionTrigger className="text-sm font-semibold py-3">Substances Treated</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {COMMON_SUBSTANCES.map((sub) => (
              <label key={sub} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={substances.includes(sub)} onCheckedChange={() => toggleSubstance(sub)} />
                <span className="text-sm">{sub}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="gender">
        <AccordionTrigger className="text-sm font-semibold py-3">Gender Policy</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={genderPolicy === ""} onCheckedChange={() => setGenderPolicy("")} />
              <span className="text-sm">Any</span>
            </label>
            {GENDER_POLICY_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={genderPolicy === option.value} onCheckedChange={() => setGenderPolicy(genderPolicy === option.value ? "" : option.value)} />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="payment">
        <AccordionTrigger className="text-sm font-semibold py-3">Payment Options</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2">
            {PAYMENT_OPTIONS.map((option) => (
              <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={paymentOptions.includes(option.value)} onCheckedChange={() => togglePayment(option.value)} />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

// ============================================================================
// Program Card (enriched with quality + insurance badges)
// ============================================================================

function ProgramCard({
  program,
  facility,
  organization,
  isCompareSelected,
  onToggleCompare,
  showActions,
  userId,
}: {
  program: any;
  facility: any;
  organization: any;
  isCompareSelected?: boolean;
  onToggleCompare?: () => void;
  showActions?: boolean;
  userId?: number;
}) {
  const qualityScore = facility?.qualityScore ?? program?.qualityScore;
  const insuranceList: string[] = facility?.acceptedInsurance ?? [];
  const substancesList: string[] = facility?.substancesTreated ?? [];

  const addBookmark = trpc.bookmarks.add.useMutation();
  const removeBookmark = trpc.bookmarks.remove.useMutation();
  const utils = trpc.useUtils();
  const { data: bookmarkIds } = trpc.bookmarks.ids.useQuery(undefined, {
    enabled: !!userId,
  });
  const isBookmarked = bookmarkIds?.includes(program.id) ?? false;

  const handleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!userId) return;
    const mutation = isBookmarked ? removeBookmark : addBookmark;
    mutation.mutate(
      { programId: program.id },
      {
        onSuccess: () => {
          utils.bookmarks.ids.invalidate();
          utils.bookmarks.list.invalidate();
        },
      }
    );
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleCompare?.();
  };

  return (
    <Link href={`/program/${program.id}`} className="block no-underline group">
      <Card className="hover:shadow-md hover:border-primary/30 transition-all">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary">
                  {formatLevelOfCare(program.levelOfCare)}
                </Badge>
                {program.telehealthAvailable && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Video className="w-3 h-3" /> Telehealth
                  </Badge>
                )}
                {qualityScore != null && qualityScore > 0 && (
                  <Badge variant={qualityScore >= 0.7 ? "default" : "secondary"} className="text-xs gap-1">
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
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {[facility.city, facility.state].filter(Boolean).join(", ")}
                </p>
              )}
              {program.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{program.description}</p>
              )}

              {/* Enriched data badges */}
              {(insuranceList.length > 0 || substancesList.length > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {insuranceList.slice(0, 3).map((ins: string) => (
                    <Badge key={ins} variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700">
                      <Shield className="w-2.5 h-2.5 mr-0.5" /> {ins}
                    </Badge>
                  ))}
                  {insuranceList.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{insuranceList.length - 3} more</Badge>
                  )}
                </div>
              )}

              {facility?.phone && (
                <p className="text-sm text-primary flex items-center gap-1 mt-2">
                  <Phone className="w-3.5 h-3.5" /> {facility.phone}
                </p>
              )}
            </div>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              {showActions && (
                <>
                  {userId && (
                    <button
                      onClick={handleBookmark}
                      className={`p-1.5 rounded-md transition-colors ${
                        isBookmarked
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                      }`}
                      title={isBookmarked ? "Remove bookmark" : "Bookmark"}
                    >
                      {isBookmarked ? (
                        <BookmarkCheck className="w-4 h-4" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleCompare}
                    className={`p-1.5 rounded-md transition-colors ${
                      isCompareSelected
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                    }`}
                    title={isCompareSelected ? "Remove from comparison" : "Add to comparison"}
                  >
                    <GitCompareArrows className="w-4 h-4" />
                  </button>
                </>
              )}
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
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
        <Link href="/find" className="text-primary hover:underline">Guided Finder</Link>{" "}
        for personalized recommendations.
      </p>
    </div>
  );
}
