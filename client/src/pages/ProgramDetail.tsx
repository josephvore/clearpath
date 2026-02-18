import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { useParams, useLocation, Link } from "wouter";
import { formatLevelOfCare, getConfidenceLabel } from "@shared/types";

export default function ProgramDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const programId = parseInt(params.id ?? "0", 10);

  const { data, isLoading, error } = trpc.program.detail.useQuery(
    { id: programId },
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

  // Compute overall confidence
  const allConfidences = assertions.map((a) => a.assertion.confidence);
  const avgConfidence =
    allConfidences.length > 0
      ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
      : 0;

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
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="border-primary/30 text-primary"
                >
                  {formatLevelOfCare(program.levelOfCare)}
                </Badge>
                {program.telehealthAvailable && (
                  <Badge variant="secondary" className="gap-1">
                    <Video className="w-3 h-3" />
                    Telehealth
                  </Badge>
                )}
                <ConfidenceBadge confidence={avgConfidence} />
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
                      <Globe className="w-3 h-3" />
                      Website
                    </a>
                  )}
                </p>
              )}
            </div>

            {/* Contact CTA */}
            <div className="flex flex-wrap gap-2">
              {facility?.phoneIntake && (
                <Button asChild variant="default" className="gap-2">
                  <a href={`tel:${facility.phoneIntake}`}>
                    <Phone className="w-4 h-4" />
                    {facility.phoneIntake}
                  </a>
                </Button>
              )}
              {facility?.emailIntake && (
                <Button asChild variant="outline" className="gap-2">
                  <a href={`mailto:${facility.emailIntake}`}>
                    <Mail className="w-4 h-4" />
                    Email
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
                    <FileText className="w-5 h-5 text-primary" />
                    About This Program
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {program.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Medical Capability */}
            {program.medicalCapability && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    Medical Capabilities
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {program.medicalCapability.nursing247 !== undefined && (
                      <CapabilityItem
                        label="24/7 Nursing"
                        available={program.medicalCapability.nursing247}
                      />
                    )}
                    {program.medicalCapability.psychiatrist !== undefined && (
                      <CapabilityItem
                        label="Psychiatrist"
                        available={program.medicalCapability.psychiatrist}
                      />
                    )}
                    {program.medicalCapability.matAvailable !== undefined && (
                      <CapabilityItem
                        label="MAT Available"
                        available={program.medicalCapability.matAvailable}
                      />
                    )}
                    {program.medicalCapability.medicallyManagedDetox !== undefined && (
                      <CapabilityItem
                        label="Medically Managed Detox"
                        available={program.medicalCapability.medicallyManagedDetox}
                      />
                    )}
                  </div>
                  {program.medicalCapability.notes && (
                    <p className="text-sm text-muted-foreground mt-3">
                      {program.medicalCapability.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tags / Specialties */}
            {Object.keys(tagsByNamespace).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Specialties & Modalities
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(tagsByNamespace).map(([ns, items]) => (
                    <div key={ns}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                        {ns.replace(/_/g, " ")}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((item) => (
                          <Tooltip key={item.tag.id}>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="secondary"
                                className="capitalize cursor-default"
                              >
                                {item.tag.label}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Confidence: {getConfidenceLabel(item.confidence)} (
                              {Math.round(item.confidence * 100)}%)
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Source Citations */}
            {assertions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Source Citations ({assertions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    Each data point is extracted from public sources. Below are the
                    citations supporting the information shown above.
                  </p>
                  {assertions.map(({ assertion, source }) => (
                    <div
                      key={assertion.id}
                      className="border rounded-lg p-3 bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">
                              {assertion.fieldPath}
                            </span>
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
                          <span>
                            Retrieved{" "}
                            {new Date(source.retrievedAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Facility Info */}
            {facility && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-primary" />
                    Facility
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <h4 className="font-medium">{facility.name}</h4>
                  {facility.addressLine1 && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div>{facility.addressLine1}</div>
                        {facility.addressLine2 && <div>{facility.addressLine2}</div>}
                        <div>
                          {[facility.city, facility.state, facility.postalCode]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                    </div>
                  )}
                  {facility.phoneIntake && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`tel:${facility.phoneIntake}`}
                        className="text-primary hover:underline"
                      >
                        {facility.phoneIntake}
                      </a>
                    </div>
                  )}
                  {facility.emailIntake && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={`mailto:${facility.emailIntake}`}
                        className="text-primary hover:underline"
                      >
                        {facility.emailIntake}
                      </a>
                    </div>
                  )}
                  {facility.facilityType && facility.facilityType !== "unknown" && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span className="capitalize">
                        {facility.facilityType.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Schedule & Stay */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Schedule & Duration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {program.schedule && (
                  <>
                    {program.schedule.daysPerWeek && (
                      <InfoRow
                        icon={<Calendar className="w-4 h-4" />}
                        label="Days/Week"
                        value={String(program.schedule.daysPerWeek)}
                      />
                    )}
                    {program.schedule.hoursPerDay && (
                      <InfoRow
                        icon={<Clock className="w-4 h-4" />}
                        label="Hours/Day"
                        value={String(program.schedule.hoursPerDay)}
                      />
                    )}
                    {program.schedule.notes && (
                      <p className="text-sm text-muted-foreground">
                        {program.schedule.notes}
                      </p>
                    )}
                  </>
                )}
                {program.lengthOfStay && (
                  <>
                    {program.lengthOfStay.typicalDays && (
                      <InfoRow
                        icon={<Clock className="w-4 h-4" />}
                        label="Typical Stay"
                        value={`${program.lengthOfStay.typicalDays} days`}
                      />
                    )}
                    {(program.lengthOfStay.minDays || program.lengthOfStay.maxDays) && (
                      <InfoRow
                        icon={<Clock className="w-4 h-4" />}
                        label="Range"
                        value={`${program.lengthOfStay.minDays ?? "?"}-${program.lengthOfStay.maxDays ?? "?"} days`}
                      />
                    )}
                  </>
                )}
                {!program.schedule && !program.lengthOfStay && (
                  <p className="text-sm text-muted-foreground">
                    Schedule information not yet available.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            {program.paymentOptions && program.paymentOptions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Payment Options
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {program.paymentOptions.map((po: string) => (
                      <Badge key={po} variant="outline" className="capitalize">
                        {po.replace(/_/g, " ")}
                      </Badge>
                    ))}
                  </div>
                  {program.insuranceNotes && (
                    <p className="text-sm text-muted-foreground mt-3">
                      {program.insuranceNotes}
                    </p>
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
                    <p className="text-sm font-medium text-amber-800 mb-1">
                      Data Quality Notice
                    </p>
                    <p className="text-xs text-amber-700 leading-relaxed">
                      This information was extracted from public sources using AI.
                      Confidence scores indicate extraction reliability. Always verify
                      directly with the provider before making decisions.
                    </p>
                    {program.lastVerifiedAt && (
                      <p className="text-xs text-amber-600 mt-2">
                        Last verified:{" "}
                        {new Date(program.lastVerifiedAt).toLocaleDateString()}
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
        <CheckCircle2 className="w-3 h-3" />
        {pct}% confidence
      </Badge>
    );
  }
  if (label === "Medium") {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        <AlertTriangle className="w-3 h-3" />
        {pct}% confidence
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-red-100 text-red-600 border-red-200 hover:bg-red-100">
      <AlertCircle className="w-3 h-3" />
      {pct}% confidence
    </Badge>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const label = getConfidenceLabel(confidence);
  const color =
    label === "High"
      ? "bg-green-500"
      : label === "Medium"
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      </TooltipTrigger>
      <TooltipContent>
        {label} confidence ({Math.round(confidence * 100)}%)
      </TooltipContent>
    </Tooltip>
  );
}

function CapabilityItem({
  label,
  available,
}: {
  label: string;
  available: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {available ? (
        <CheckCircle2 className="w-4 h-4 text-green-600" />
      ) : (
        <AlertCircle className="w-4 h-4 text-muted-foreground" />
      )}
      <span className={`text-sm ${available ? "text-foreground" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
