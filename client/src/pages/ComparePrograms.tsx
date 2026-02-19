import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Phone,
  Star,
  Video,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Minus,
  Loader2,
  GitCompareArrows,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import { formatLevelOfCare, getConfidenceLabel } from "@shared/types";

export default function ComparePrograms() {
  const searchParams = new URLSearchParams(useSearch());
  const ids = searchParams
    .get("ids")
    ?.split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0);

  const { data, isLoading } = trpc.compare.programs.useQuery(
    { ids: ids ?? [] },
    { enabled: !!ids && ids.length > 0 }
  );

  if (!ids || ids.length === 0) {
    return (
      <div className="container py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <GitCompareArrows className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No Programs Selected</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Select 2-3 programs from the search results to compare them side by side.
        </p>
        <Button asChild>
          <Link href="/search">Browse Programs</Link>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading comparison...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="container py-16 text-center">
        <h2 className="text-xl font-semibold mb-2">Programs Not Found</h2>
        <p className="text-muted-foreground mb-6">The selected programs could not be loaded.</p>
        <Button asChild variant="outline">
          <Link href="/search">Back to Search</Link>
        </Button>
      </div>
    );
  }

  const programs = data;

  // Collect all unique tag namespaces
  const conditionSet = new Set<string>();
  const substanceSet = new Set<string>();
  const populationSet = new Set<string>();
  const modalitySet = new Set<string>();

  programs.forEach((p: any) => {
    p.tags.forEach((t: any) => {
      const label = t.tag.label;
      switch (t.tag.namespace) {
        case "condition":
          conditionSet.add(label);
          break;
        case "substance":
          substanceSet.add(label);
          break;
        case "population":
          populationSet.add(label);
          break;
        case "modality":
        case "treatment_approach":
          modalitySet.add(label);
          break;
      }
    });
  });

  const allConditions = Array.from(conditionSet);
  const allSubstances = Array.from(substanceSet);
  const allPopulations = Array.from(populationSet);
  const allModalities = Array.from(modalitySet);

  const colWidth = programs.length === 2 ? "w-1/2" : programs.length === 3 ? "w-1/3" : "w-1/4";

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/search">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <GitCompareArrows className="w-5 h-5 text-primary" />
                Compare Programs
              </h1>
              <p className="text-sm text-muted-foreground">
                Comparing {programs.length} program{programs.length > 1 ? "s" : ""} side by side
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container py-6">
        {/* Program Headers */}
        <div className="flex gap-4 mb-6">
          {programs.map((p) => (
            <div key={p.program.id} className={`${colWidth} min-w-0`}>
              <Card className="h-full">
                <CardContent className="p-4">
                  <Badge variant="outline" className="text-xs mb-2 border-primary/30 text-primary">
                    {formatLevelOfCare(p.program.levelOfCare)}
                  </Badge>
                  <h3 className="font-semibold text-sm line-clamp-2 mb-1">
                    <Link href={`/program/${p.program.id}`} className="hover:text-primary transition-colors">
                      {p.program.name}
                    </Link>
                  </h3>
                  {p.organization && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Building2 className="w-3 h-3 shrink-0" /> {p.organization.name}
                    </p>
                  )}
                  {p.facility && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0" />{" "}
                      {[p.facility.city, p.facility.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="space-y-1">
          <CompareSection title="Overview">
            <CompareRow label="Level of Care" programs={programs} render={(p) => formatLevelOfCare(p.program.levelOfCare)} />
            <CompareRow label="Program Type" programs={programs} render={(p) => p.program.programType?.replace(/_/g, " ") ?? "—"} />
            <CompareRow label="Duration" programs={programs} render={(p) => p.program.duration ?? "—"} />
            <CompareRow label="Schedule" programs={programs} render={(p) => p.program.scheduleText ?? "—"} />
            <CompareRow
              label="Telehealth"
              programs={programs}
              render={(p) =>
                p.program.telehealthAvailable ? (
                  <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="w-3.5 h-3.5" /> No</span>
                )
              }
            />
          </CompareSection>

          <CompareSection title="Quality & Confidence">
            <CompareRow
              label="Quality Score"
              programs={programs}
              render={(p) => {
                const score = p.program.qualityScore;
                if (score == null) return <span className="text-muted-foreground">—</span>;
                return (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="font-medium">{Math.round(score * 100)}%</span>
                    <span className="text-xs text-muted-foreground">({getConfidenceLabel(score)})</span>
                  </span>
                );
              }}
            />
            <CompareRow
              label="Completeness"
              programs={programs}
              render={(p) => {
                const score = p.program.completenessScore;
                if (score == null) return "—";
                return `${Math.round(score * 100)}%`;
              }}
            />
          </CompareSection>

          <CompareSection title="Location & Contact">
            <CompareRow
              label="Address"
              programs={programs}
              render={(p) =>
                p.facility
                  ? [p.facility.addressLine1, p.facility.city, p.facility.state, p.facility.postalCode]
                      .filter(Boolean)
                      .join(", ")
                  : "—"
              }
            />
            <CompareRow
              label="Phone"
              programs={programs}
              render={(p) =>
                p.facility?.phone ? (
                  <a href={`tel:${p.facility.phone}`} className="text-primary hover:underline flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {p.facility.phone}
                  </a>
                ) : (
                  "—"
                )
              }
            />
          </CompareSection>

          <CompareSection title="Insurance & Payment">
            <CompareRow
              label="Accepted Insurance"
              programs={programs}
              render={(p) => {
                const ins: string[] = p.facility?.acceptedInsurance ?? [];
                if (ins.length === 0) return <span className="text-muted-foreground">Not specified</span>;
                return (
                  <div className="flex flex-wrap gap-1">
                    {ins.map((i) => (
                      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700">
                        <Shield className="w-2.5 h-2.5 mr-0.5" /> {i}
                      </Badge>
                    ))}
                  </div>
                );
              }}
            />
            <CompareRow
              label="Payment Options"
              programs={programs}
              render={(p) => {
                const pay: string[] = p.facility?.paymentOptions ?? p.program.paymentOptions ?? [];
                if (pay.length === 0) return "—";
                return pay.map((o) => o.replace(/_/g, " ")).join(", ");
              }}
            />
          </CompareSection>

          {allConditions.length > 0 && (
            <CompareSection title="Conditions Treated">
              {allConditions.sort().map((condition) => (
                <CompareRow
                  key={condition}
                  label={condition}
                  programs={programs}
                  render={(p) => {
                    const has = p.tags.some((t: any) => t.tag.namespace === "condition" && t.tag.label === condition);
                    return has ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/40" />
                    );
                  }}
                />
              ))}
            </CompareSection>
          )}

          {allSubstances.length > 0 && (
            <CompareSection title="Substances Treated">
              {allSubstances.sort().map((substance) => (
                <CompareRow
                  key={substance}
                  label={substance}
                  programs={programs}
                  render={(p) => {
                    const has = p.tags.some((t: any) => t.tag.namespace === "substance" && t.tag.label === substance);
                    return has ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/40" />
                    );
                  }}
                />
              ))}
            </CompareSection>
          )}

          {allPopulations.length > 0 && (
            <CompareSection title="Populations Served">
              {allPopulations.sort().map((pop) => (
                <CompareRow
                  key={pop}
                  label={pop}
                  programs={programs}
                  render={(p) => {
                    const has = p.tags.some((t: any) => t.tag.namespace === "population" && t.tag.label === pop);
                    return has ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/40" />
                    );
                  }}
                />
              ))}
            </CompareSection>
          )}

          {allModalities.length > 0 && (
            <CompareSection title="Treatment Approaches">
              {allModalities.sort().map((mod) => (
                <CompareRow
                  key={mod}
                  label={mod}
                  programs={programs}
                  render={(p) => {
                    const has = p.tags.some(
                      (t: any) => (t.tag.namespace === "modality" || t.tag.namespace === "treatment_approach") && t.tag.label === mod
                    );
                    return has ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <Minus className="w-4 h-4 text-muted-foreground/40" />
                    );
                  }}
                />
              ))}
            </CompareSection>
          )}

          <CompareSection title="Eligibility & Details">
            <CompareRow
              label="Eligibility"
              programs={programs}
              render={(p) => p.program.eligibility ?? "—"}
            />
            <CompareRow
              label="Description"
              programs={programs}
              render={(p) => (
                <p className="text-xs leading-relaxed line-clamp-4">{p.program.description ?? "—"}</p>
              )}
            />
          </CompareSection>
        </div>

        {/* Back button */}
        <div className="flex justify-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/search">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Search
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Comparison Components
// ============================================================================

function CompareSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader className="py-3 px-4 bg-muted/30">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 divide-y">{children}</CardContent>
    </Card>
  );
}

function CompareRow({
  label,
  programs,
  render,
}: {
  label: string;
  programs: any[];
  render: (p: any) => React.ReactNode;
}) {
  const colWidth = programs.length === 2 ? "w-1/2" : programs.length === 3 ? "w-1/3" : "w-1/4";

  return (
    <div className="flex items-start">
      <div className="w-40 shrink-0 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/10 border-r flex items-center">
        {label}
      </div>
      <div className="flex flex-1">
        {programs.map((p, i) => (
          <div
            key={p.program.id}
            className={`${colWidth} px-4 py-2.5 text-sm ${i < programs.length - 1 ? "border-r" : ""}`}
          >
            {render(p)}
          </div>
        ))}
      </div>
    </div>
  );
}
