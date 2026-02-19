import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MapPin,
  Building2,
  Loader2,
  Search,
  Globe,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { US_STATES } from "@shared/types";

export default function BrowseStates() {
  const [search, setSearch] = useState("");
  const { data: stateStats, isLoading } = trpc.browse.states.useQuery();

  const stateMap = useMemo(() => {
    const map: Record<string, { facilityCount: number; programCount: number }> = {};
    if (stateStats) {
      stateStats.forEach((s: any) => {
        map[s.state] = { facilityCount: s.facilityCount, programCount: s.programCount };
      });
    }
    return map;
  }, [stateStats]);

  const filteredStates = useMemo(() => {
    const q = search.toLowerCase();
    return US_STATES.filter(
      (s) =>
        s.label.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
    );
  }, [search]);

  // Group states by region
  const regions: Record<string, Array<{ value: string; label: string }>> = {
    Northeast: US_STATES.filter((s) =>
      ["CT", "DE", "ME", "MD", "MA", "NH", "NJ", "NY", "PA", "RI", "VT", "DC"].includes(s.value)
    ),
    Southeast: US_STATES.filter((s) =>
      ["AL", "AR", "FL", "GA", "KY", "LA", "MS", "NC", "SC", "TN", "VA", "WV"].includes(s.value)
    ),
    Midwest: US_STATES.filter((s) =>
      ["IL", "IN", "IA", "KS", "MI", "MN", "MO", "NE", "ND", "OH", "SD", "WI"].includes(s.value)
    ),
    West: US_STATES.filter((s) =>
      ["AK", "AZ", "CA", "CO", "HI", "ID", "MT", "NV", "NM", "OR", "UT", "WA", "WY"].includes(s.value)
    ),
    Southwest: US_STATES.filter((s) => ["TX", "OK"].includes(s.value)),
  };

  const totalFacilities = stateStats
    ? stateStats.reduce((sum: number, s: any) => sum + s.facilityCount, 0)
    : 0;
  const totalPrograms = stateStats
    ? stateStats.reduce((sum: number, s: any) => sum + s.programCount, 0)
    : 0;

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white">
        <div className="container py-12">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold mb-3 flex items-center gap-3">
              <Globe className="w-8 h-8" />
              Browse by State
            </h1>
            <p className="text-teal-100 text-lg mb-6">
              Explore treatment programs across all 50 states and the District of Columbia.
            </p>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-2xl font-bold">{totalFacilities.toLocaleString()}</span>
                <span className="text-teal-200 ml-1">Facilities</span>
              </div>
              <div>
                <span className="text-2xl font-bold">{totalPrograms.toLocaleString()}</span>
                <span className="text-teal-200 ml-1">Programs</span>
              </div>
              <div>
                <span className="text-2xl font-bold">51</span>
                <span className="text-teal-200 ml-1">States & DC</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-8">
        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search states..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Loading state data...</span>
          </div>
        )}

        {!isLoading && search ? (
          /* Filtered view */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStates.map((state) => (
              <StateCard
                key={state.value}
                state={state}
                stats={stateMap[state.value]}
              />
            ))}
            {filteredStates.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No states match "{search}"
              </div>
            )}
          </div>
        ) : (
          /* Region-grouped view */
          !isLoading &&
          Object.entries(regions).map(([region, states]) => (
            <div key={region} className="mb-8">
              <h2 className="text-lg font-semibold mb-4 text-foreground border-b pb-2">
                {region}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {states.map((state) => (
                  <StateCard
                    key={state.value}
                    state={state}
                    stats={stateMap[state.value]}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function StateCard({
  state,
  stats,
}: {
  state: { value: string; label: string };
  stats?: { facilityCount: number; programCount: number };
}) {
  return (
    <Link href={`/programs/${state.value.toLowerCase()}`} className="no-underline group">
      <Card className="hover:shadow-md hover:border-primary/30 transition-all h-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {state.label}
              </h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {stats?.facilityCount ?? 0} facilities
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {stats?.programCount ?? 0} programs
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
