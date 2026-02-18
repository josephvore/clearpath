import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Video,
  Clock,
  Calendar,
  Shield,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Stethoscope,
  Users,
  CreditCard,
  FileText,
  Globe,
  Star,
  History,
  Award,
  Pill,
  Heart,
} from "lucide-react";
import { useParams, useLocation, Link } from "wouter";
import { formatLevelOfCare, getConfidenceLabel, formatFacilityType } from "@shared/types";

export default function ProgramDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const programId = parseInt(params.id ?? "0", 10);

  const { data, isLoading, error } = trpc.program.detail.useQuery(
    { id: programId },
    { enabled: programId > 0 }
  );

  const { data: fieldChanges } = trpc.program.fieldChanges.useQuery(
    { entityType: "program", entityId: programId, limit: 20 },
    { enabled: programId > 0 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading program details...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-12 text-center">
        <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Program Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The program you're looking for doesn't exist or has been removed.
        </p>
        <Button onClick={() => setLocation("/search")}>Back to Search</Button>
      </div>
    );
  }

  const { program, facility, organization, tags, assertions, facilityAssertions } = data;

  const tagsByNamespace: Record<string, { tag: any; confidence: number }[]> = {};
  for (const t of tags) {
    const ns = t.tag.namespace;
    if (!tagsByNamespace[ns]) tagsByNamespace[ns] = [];
    tagsByNamespace[ns].push(t);
  }

  const allConfidences = assertions.map((a) => a.assertion.confidence);
  const avgConfidence =
    allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

  const qualityScore = program.qualityScore ?? facility?.qualityScore ?? 0;
  const insuranceList: string[] = facility?.acceptedInsurance as string[] ?? [];
  const substancesList: string[] = facility?.substancesTreated as string[] ?? [];
  const accreditationsList: string[] = facility?.accreditations as string[] ?? [];
  const specializations: string[] = facility?.specializations as string[] ?? [];

  return (
    <div className="bg-muted/20 min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container py-6">
          <button
            onClick={() => setLocation("/search")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to search
          </button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant="outline" className="border-primary/30 text-primary">
                  {formatLevelOfCare(program.levelOfCare)}
                </Badge>
                {program.programType && program.programType !== program.levelOfCare && (
                  <Badge variant="outline" className="text-xs">
                    {program.programType.replace(/_/g, " ")}
                  </Badge>
                )}
                {program.telehealthAvailable && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="w-3 h-3" /> Telehealth
                  </Badge>
                )}
                <ConfidenceBadge confidence={avgConfidence} />
                {qualityScore > 0 && (
                  <QualityBadge score={qualityScore} />
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {program.name}
              </h1>
              {organization && (
                <p className="text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Building2 className="w-4 h-4 shrink-0" />
                  {organization.name}
                  {organization.websiteDomain && (
                    <a
                      href={`https://${organization.websiteDomain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-0.5 ml-1"
                    >
                      <Globe className="w-3 h-3" /> Website
                    </a>
                  )}
                </p>
              )}
              {facility && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {[facility.addressLine1, facility.city, facility.state, facility.postalCode].filter(Boolean).join(", ")}
                </p>
              )}
            </div>

            {/* Contact CTA */}
            <div className="flex flex-wrap gap-2">
              {facility?.phone && (
                <Button asChild variant="default" className="gap-2">
                  <a href={`tel:${facility.phone}`}>
                    <Phone className="w-4 h-4" /> {facility.phone}
                  </a>
                </Button>
              )}
              {facility?.email && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={`mailto:${facility.email}`}>
                    <Mail className="w-4 h-4" /> Email
                  </a>
                </Button>
              )}
              {facility?.website && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={facility.website.startsWith("http") ? facility.website : `https://${facility.website}`} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4" /> Website
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {program.description && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" /> About This Program
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{program.description}</p>
                  {program.eligibility && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <h4 className="text-sm font-medium mb-1">Eligibility Criteria</h4>
                      <p className="text-sm text-muted-foreground">{program.eligibility}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Insurance & Substances (enriched) */}
            {(insuranceList.length > 0 || substancesList.length > 0 || accreditationsList.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" /> Insurance, Substances & Accreditations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insuranceList.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Accepted Insurance ({insuranceList.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {insuranceList.map((ins: string) => (
                          <Badge key={ins} variant="outline" className="border-green-300 text-green-700 bg-green-50">
                            {ins}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {substancesList.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5" /> Substances Treated ({substancesList.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {substancesList.map((sub: string) => (
                          <Badge key={sub} variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {accreditationsList.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" /> Accreditations
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {accreditationsList.map((acc: string) => (
                          <Badge key={acc} variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                            {acc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Medical Capability */}
            {program.medicalCapability && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" /> Medical Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {program.medicalCapability.nursing247 !== undefined && (
                      <CapabilityItem label="24/7 Nursing" available={program.medicalCapability.nursing247} />
                    )}
                    {program.medicalCapability.psychiatrist !== undefined && (
                      <CapabilityItem label="Psychiatrist" available={program.medicalCapability.psychiatrist} />
                    )}
                    {program.medicalCapability.matAvailable !== undefined && (
                      <CapabilityItem label="MAT Available" available={program.medicalCapability.matAvailable} />
                    )}
                    {program.medicalCapability.medicallyManagedDetox !== undefined && (
                      <CapabilityItem label="Medically Managed Detox" available={program.medicalCapability.medicallyManagedDetox} />
                    )}
                  </div>
                  {program.medicalCapability.notes && (
                    <p className="text-sm text-muted-foreground mt-3">{program.medicalCapability.notes}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tags / Specialties */}
            {(Object.keys(tagsByNamespace).length > 0 || specializations.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" /> Specialties & Modalities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {specializations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Facility Specializations</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {specializations.map((spec: string) => (
                          <Badge key={spec} variant="secondary" className="capitalize">{spec}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {Object.entries(tagsByNamespace).map(([ns, items]) => (
                    <div key={ns}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                        {ns.replace(/_/g, " ")}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item) => (
                          <Tooltip key={item.tag.id}>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="capitalize cursor-default">
                                {item.tag.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Confidence: {getConfidenceLabel(item.confidence)} ({Math.round(item.confidence * 100)}%)
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Source Citations & Change History Tabs */}
            <Card>
              <Tabs defaultValue="citations">
                <CardHeader>
                  <TabsList className="w-full">
                    <TabsTrigger value="citations" className="flex-1 gap-1">
                      <Shield className="w-3.5 h-3.5" /> Citations ({assertions.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="flex-1 gap-1">
                      <History className="w-3.5 h-3.5" /> Change History
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent>
                  <TabsContent value="citations" className="mt-0 space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      Each data point is extracted from public sources. Below are the citations supporting the information shown above.
                    </p>
                    {assertions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No citations available yet.</p>
                    ) : (
                      assertions.map(({ assertion, source }) => (
                        <div key={assertion.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-mono text-muted-foreground">{assertion.fieldPath}</span>
                                <ConfidenceDot confidence={assertion.confidence} />

                              </div>
                              {assertion.sourceExcerpt && (
                                <blockquote className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3 mt-1">
                                  "{assertion.sourceExcerpt}"
                                </blockquote>
                              )}
                            </div>
                          </div>
                          {source && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <ExternalLink className="w-3 h-3" />
                              <span className="truncate">{source.domain}</span>
                              <span>·</span>
                              <span>Retrieved {new Date(source.retrievedAt).toLocaleDateString()}</span>
                              {source.sourceType && (
                                <>
                                  <span>·</span>
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">{source.sourceType}</Badge>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="history" className="mt-0 space-y-3">
                    <p className="text-sm text-muted-foreground mb-3">
                      Track how this program's data has changed over time as new sources are ingested.
                    </p>
                    {!fieldChanges || fieldChanges.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No changes recorded yet.</p>
                    ) : (
                      fieldChanges.map((change: any) => (
                        <div key={change.id} className="border rounded-lg p-3 bg-muted/30">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">{change.fieldPath}</span>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(change.changedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            {change.oldValue && (
                              <span className="line-through text-red-500 text-xs truncate max-w-[150px]">
                                {typeof change.oldValue === "string" ? change.oldValue : JSON.stringify(change.oldValue)}
                              </span>
                            )}
                            <span className="text-muted-foreground">→</span>
                            <span className="text-green-600 text-xs truncate max-w-[150px]">
                              {typeof change.newValue === "string" ? change.newValue : JSON.stringify(change.newValue)}
                            </span>
                          </div>
                          {change.reason && (
                            <p className="text-xs text-muted-foreground mt-1">{change.reason}</p>
                          )}
                        </div>
                      ))
                    )}
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Facility Info */}
            {facility && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" /> Facility
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <h4 className="font-medium">{facility.name}</h4>
                  {facility.facilityType && facility.facilityType !== "unknown" && (
                    <Badge variant="outline" className="capitalize">
                      {formatFacilityType(facility.facilityType)}
                    </Badge>
                  )}
                  {facility.addressLine1 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div>{facility.addressLine1}</div>
                        {facility.addressLine2 && <div>{facility.addressLine2}</div>}
                        <div>{[facility.city, facility.state, facility.postalCode].filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                  )}
                  {facility.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${facility.phone}`} className="text-primary hover:underline">{facility.phone}</a>
                      {facility.phoneVerified && (
                        <Tooltip>
                          <TooltipTrigger><CheckCircle2 className="w-3.5 h-3.5 text-green-500" /></TooltipTrigger>
                          <TooltipContent>Phone verified</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  )}
                  {facility.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a href={`mailto:${facility.email}`} className="text-primary hover:underline">{facility.email}</a>
                    </div>
                  )}
                  {facility.genderPolicy && facility.genderPolicy !== "co_ed" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="capitalize">{facility.genderPolicy.replace(/_/g, " ")}</span>
                    </div>
                  )}
                  {facility.capacity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{facility.capacity} beds</span>
                    </div>
                  )}
                  {facility.qualityScore != null && facility.qualityScore > 0 && (
                    <div className="mt-2">
                      <QualityBar score={facility.qualityScore} label="Facility Quality" />
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Schedule & Stay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" /> Schedule & Duration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {program.schedule && (
                  <>
                    {program.schedule.daysPerWeek && (
                      <InfoRow icon={<Calendar className="w-4 h-4" />} label="Days/Week" value={String(program.schedule.daysPerWeek)} />
                    )}
                    {program.schedule.hoursPerDay && (
                      <InfoRow icon={<Clock className="w-4 h-4" />} label="Hours/Day" value={String(program.schedule.hoursPerDay)} />
                    )}
                    {program.schedule.notes && (
                      <p className="text-sm text-muted-foreground">{program.schedule.notes}</p>
                    )}
                  </>
                )}
                {program.lengthOfStay && (
                  <>
                    {program.lengthOfStay.typicalDays && (
                      <InfoRow icon={<Clock className="w-4 h-4" />} label="Typical Stay" value={`${program.lengthOfStay.typicalDays} days`} />
                    )}
                    {(program.lengthOfStay.minDays || program.lengthOfStay.maxDays) && (
                      <InfoRow icon={<Clock className="w-4 h-4" />} label="Range" value={`${program.lengthOfStay.minDays ?? "?"}-${program.lengthOfStay.maxDays ?? "?"} days`} />
                    )}
                  </>
                )}
                {!program.schedule && !program.lengthOfStay && (
                  <p className="text-sm text-muted-foreground">Schedule information not yet available.</p>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            {program.paymentOptions && program.paymentOptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" /> Payment Options
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {program.paymentOptions.map((po: string) => (
                      <Badge key={po} variant="outline" className="capitalize">{po.replace(/_/g, " ")}</Badge>
                    ))}
                  </div>
                  {program.insuranceNotes && (
                    <p className="text-sm text-muted-foreground mt-3">{program.insuranceNotes}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Data Quality */}
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 mb-1">Data Quality Notice</p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      This information was extracted from public sources using AI. Confidence scores indicate extraction reliability. Always verify directly with the provider before making decisions.
                    </p>
                    {program.qualityScore != null && program.qualityScore > 0 && (
                      <div className="mt-2">
                        <QualityBar score={program.qualityScore} label="Program Quality" />
                      </div>
                    )}
                    {program.lastVerifiedAt && (
                      <p className="text-xs text-amber-600 mt-2">
                        Last verified: {new Date(program.lastVerifiedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const label = getConfidenceLabel(confidence);
  const pct = Math.round(confidence * 100);
  if (label === "High") {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
        <CheckCircle2 className="w-3 h-3" /> {pct}% confidence
      </Badge>
    );
  }
  if (label === "Medium") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="w-3 h-3" /> {pct}% confidence
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-red-100 text-red-600 border-red-200 hover:bg-red-100">
      <AlertCircle className="w-3 h-3" /> {pct}% confidence
    </Badge>
  );
}

function QualityBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? "bg-teal-100 text-teal-700 border-teal-200" : score >= 0.4 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-600 border-red-200";
  return (
    <Badge className={`gap-1 ${color} hover:${color}`}>
      <Star className="w-3 h-3" /> {pct}% quality
    </Badge>
  );
}

function QualityBar({ score, label }: { score: number; label: string }) {
  const pct = Math.round(score * 100);
  const barColor = score >= 0.7 ? "bg-teal-500" : score >= 0.4 ? "bg-amber-500" : "bg-red-500";
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{pct}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const label = getConfidenceLabel(confidence);
  const color = label === "High" ? "bg-green-500" : label === "Medium" ? "bg-amber-500" : "bg-red-500";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      </TooltipTrigger>
      <TooltipContent>{label} confidence ({Math.round(confidence * 100)}%)</TooltipContent>
    </Tooltip>
  );
}

function CapabilityItem({ label, available }: { label: string; available: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {available ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
      <span className={`text-sm ${available ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}{label}</div>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
