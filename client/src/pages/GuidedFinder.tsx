import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Compass,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Building2,
  Phone,
  Video,
  Loader2,
  CheckCircle2,
  Heart,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  LEVEL_OF_CARE_OPTIONS,
  PAYMENT_OPTIONS,
  formatLevelOfCare,
} from "@shared/types";

type Step = "welcome" | "concerns" | "level" | "location" | "insurance" | "results";

const CONCERN_OPTIONS = [
  "Alcohol Use",
  "Opioid Use",
  "Stimulant Use",
  "Benzodiazepine Use",
  "Cannabis Use",
  "Depression",
  "Anxiety",
  "PTSD / Trauma",
  "Bipolar Disorder",
  "Eating Disorder",
  "Dual Diagnosis",
  "Chronic Pain",
];

const AGE_GROUPS = [
  { value: "adolescent", label: "Adolescent (12-17)" },
  { value: "young_adult", label: "Young Adult (18-25)" },
  { value: "adult", label: "Adult (26-64)" },
  { value: "senior", label: "Senior (65+)" },
];

export default function GuidedFinder() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [substanceRelated, setSubstanceRelated] = useState<boolean | undefined>(undefined);
  const [ageGroup, setAgeGroup] = useState("");
  const [levelOfCare, setLevelOfCare] = useState<string[]>([]);
  const [location, setLoc] = useState("");
  const [telehealthOk, setTelehealthOk] = useState(false);
  const [insurance, setInsurance] = useState<string[]>([]);

  const matchMutation = trpc.match.find.useMutation();

  const handleSubmit = () => {
    matchMutation.mutate({
      primaryConcerns: concerns.length > 0 ? concerns : undefined,
      substanceRelated,
      ageGroup: ageGroup || undefined,
      levelOfCareTarget: levelOfCare.length > 0 ? levelOfCare : undefined,
      location: location || undefined,
      telehealthOk: telehealthOk || undefined,
      insuranceType: insurance.length > 0 ? insurance : undefined,
      distanceMiles: 50,
    });
    setStep("results");
  };

  const steps: Step[] = ["welcome", "concerns", "level", "location", "insurance", "results"];
  const currentIndex = steps.indexOf(step);
  const progress = ((currentIndex) / (steps.length - 1)) * 100;

  const goNext = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < steps.length) {
      if (steps[nextIndex] === "results") {
        handleSubmit();
      } else {
        setStep(steps[nextIndex]);
      }
    }
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) setStep(steps[prevIndex]);
  };

  return (
    <div className="min-h-[calc(100vh-200px)] bg-gradient-to-b from-primary/5 to-background">
      <div className="container py-8 max-w-2xl mx-auto">
        {/* Progress */}
        {step !== "welcome" && step !== "results" && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>Step {currentIndex} of {steps.length - 2}</span>
              <span>{Math.round(progress)}% complete</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Welcome */}
        {step === "welcome" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
              <Compass className="w-8 h-8" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Find Your Path to Recovery
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              Answer a few simple questions and we'll match you with treatment programs
              that fit your needs. This is confidential and takes about 2 minutes.
            </p>
            <Button size="lg" onClick={goNext} className="gap-2">
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Button>
            <p className="text-xs text-muted-foreground mt-6 max-w-md mx-auto">
              This tool does not provide medical advice. Results are based on publicly
              available program data. Always consult a healthcare professional.
            </p>
          </div>
        )}

        {/* Concerns */}
        {step === "concerns" && (
          <StepCard
            title="What are your primary concerns?"
            subtitle="Select all that apply. This helps us find programs with relevant specialties."
            onNext={goNext}
            onBack={goBack}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {CONCERN_OPTIONS.map((concern) => (
                  <label
                    key={concern}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      concerns.includes(concern)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Checkbox
                      checked={concerns.includes(concern)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setConcerns([...concerns, concern]);
                        } else {
                          setConcerns(concerns.filter((c) => c !== concern));
                        }
                      }}
                    />
                    <span className="text-sm">{concern}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4">
                <Label className="text-sm font-medium mb-2 block">Age Group</Label>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select age group" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGE_GROUPS.map((ag) => (
                      <SelectItem key={ag.value} value={ag.value}>
                        {ag.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </StepCard>
        )}

        {/* Level of Care */}
        {step === "level" && (
          <StepCard
            title="What level of care are you looking for?"
            subtitle="Select the intensity levels you're considering. Not sure? Select multiple."
            onNext={goNext}
            onBack={goBack}
          >
            <div className="space-y-2">
              {LEVEL_OF_CARE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    levelOfCare.includes(option.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Checkbox
                    checked={levelOfCare.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setLevelOfCare([...levelOfCare, option.value]);
                      } else {
                        setLevelOfCare(levelOfCare.filter((l) => l !== option.value));
                      }
                    }}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </StepCard>
        )}

        {/* Location */}
        {step === "location" && (
          <StepCard
            title="Where are you looking for treatment?"
            subtitle="Enter a city, state, or zip code. Leave blank for nationwide results."
            onNext={goNext}
            onBack={goBack}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={location}
                    onChange={(e) => setLoc(e.target.value)}
                    placeholder="City, State, or Zip Code"
                    className="pl-9"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-primary/30 transition-colors">
                <Checkbox
                  checked={telehealthOk}
                  onCheckedChange={(checked) => setTelehealthOk(checked === true)}
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Include telehealth options</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Virtual programs available from anywhere
                  </span>
                </div>
              </label>
            </div>
          </StepCard>
        )}

        {/* Insurance */}
        {step === "insurance" && (
          <StepCard
            title="How will you pay for treatment?"
            subtitle="Select all payment methods you can use."
            onNext={goNext}
            onBack={goBack}
            nextLabel="Find Programs"
          >
            <div className="space-y-2">
              {PAYMENT_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    insurance.includes(option.value)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <Checkbox
                    checked={insurance.includes(option.value)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setInsurance([...insurance, option.value]);
                      } else {
                        setInsurance(insurance.filter((i) => i !== option.value));
                      }
                    }}
                  />
                  <span className="text-sm font-medium">{option.label}</span>
                </label>
              ))}
            </div>
          </StepCard>
        )}

        {/* Results */}
        {step === "results" && (
          <div>
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Your Matches
              </h2>
              <p className="text-muted-foreground">
                Based on your preferences, here are programs that may be a good fit.
              </p>
            </div>

            {matchMutation.isPending && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Finding matching programs...</span>
              </div>
            )}

            {matchMutation.data && (
              <>
                {matchMutation.data.results.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Heart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-semibold text-lg mb-2">No Exact Matches</h3>
                      <p className="text-muted-foreground mb-4">
                        We couldn't find programs matching all your criteria. Try
                        broadening your search or explore all programs.
                      </p>
                      <div className="flex gap-3 justify-center">
                        <Button variant="outline" onClick={() => setStep("concerns")}>
                          Adjust Criteria
                        </Button>
                        <Button onClick={() => setLocation("/search")}>
                          Browse All Programs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Found{" "}
                      <span className="font-medium text-foreground">
                        {matchMutation.data.total}
                      </span>{" "}
                      matching programs
                    </p>
                    {matchMutation.data.results.map((result: any) => (
                      <Link
                        key={result.program.id}
                        href={`/program/${result.program.id}`}
                        className="block no-underline group"
                      >
                        <Card className="hover:shadow-md hover:border-primary/30 transition-all">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-primary/30 text-primary"
                                  >
                                    {formatLevelOfCare(result.program.levelOfCare)}
                                  </Badge>
                                  {result.program.telehealthAvailable && (
                                    <Badge variant="secondary" className="text-xs gap-1">
                                      <Video className="w-3 h-3" />
                                      Telehealth
                                    </Badge>
                                  )}
                                </div>
                                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                  {result.program.name}
                                </h3>
                                {result.organization && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    {result.organization.name}
                                  </p>
                                )}
                                {result.facility && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {[result.facility.city, result.facility.state]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}

                    <div className="flex gap-3 justify-center mt-6">
                      <Button variant="outline" onClick={() => setStep("concerns")}>
                        Adjust Criteria
                      </Button>
                      <Button onClick={() => setLocation("/search")}>
                        View All Programs
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {matchMutation.error && (
              <Card className="border-destructive/30">
                <CardContent className="p-6 text-center">
                  <p className="text-destructive mb-3">
                    Something went wrong. Please try again.
                  </p>
                  <Button variant="outline" onClick={handleSubmit}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StepCard({
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextLabel = "Continue",
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  nextLabel?: string;
}) {
  return (
    <Card>
      <CardContent className="p-6 md:p-8">
        <h2 className="text-xl font-bold text-foreground mb-1">{title}</h2>
        <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>
        {children}
        <div className="flex items-center justify-between mt-8 pt-4 border-t">
          <Button variant="ghost" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button onClick={onNext} className="gap-1">
            {nextLabel}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
