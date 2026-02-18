import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Compass,
  Shield,
  MapPin,
  FileCheck,
  ArrowRight,
  Heart,
  Building2,
  Users,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      setLocation("/search");
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/30">
        <div className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="secondary" className="mb-4 text-primary border-primary/20">
              <Shield className="w-3 h-3 mr-1" />
              Citation-backed data
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground mb-6 leading-tight">
              Find the Right
              <span className="text-primary block">Treatment Program</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              Search and compare behavioral health and addiction treatment programs
              with transparent, AI-extracted data backed by source citations and
              confidence scores.
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-xl mx-auto mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search programs, facilities, or conditions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-base bg-white shadow-sm"
                  />
                </div>
                <Button type="submit" size="lg" className="h-12 px-6">
                  Search
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Popular:</span>
              {["IOP", "Residential", "Detox", "PHP", "Dual Diagnosis"].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    setLocation(`/search?q=${encodeURIComponent(term)}`);
                  }}
                  className="px-2.5 py-1 rounded-full bg-white border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-foreground"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              How EquipFlow Works
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We crawl public provider websites and directories, then use AI to extract
              and normalize treatment program details with full source citations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <FeatureCard
              icon={<Search className="w-6 h-6" />}
              title="Search & Filter"
              description="Find programs by level of care, location, specialties, insurance, and more. Results include confidence scores and verification dates."
            />
            <FeatureCard
              icon={<FileCheck className="w-6 h-6" />}
              title="Source Citations"
              description="Every data point links back to its source with an excerpt. Know exactly where information came from and how confident the extraction is."
            />
            <FeatureCard
              icon={<MapPin className="w-6 h-6" />}
              title="Map Discovery"
              description="View treatment facilities on an interactive map. Filter by distance, get directions, and find programs near you."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/5">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl font-bold text-foreground mb-4">
                  Not Sure Where to Start?
                </h2>
                <p className="text-muted-foreground mb-6 leading-relaxed">
                  Our guided finder walks you through a few simple questions about
                  your needs and preferences, then matches you with appropriate
                  treatment programs.
                </p>
                <Button
                  size="lg"
                  onClick={() => setLocation("/find")}
                  className="gap-2"
                >
                  <Compass className="w-5 h-5" />
                  Start Guided Finder
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <StatCard icon={<Building2 />} label="Facilities" value="Nationwide" />
                <StatCard icon={<Heart />} label="Programs" value="All Levels" />
                <StatCard icon={<Users />} label="Populations" value="All Ages" />
                <StatCard icon={<CheckCircle2 />} label="Data" value="Verified" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Levels of Care */}
      <section className="py-16">
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Levels of Care
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Treatment programs are organized by intensity level. Understanding these
              levels helps you find the right fit.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[
              { level: "Detox", desc: "Medical detoxification and stabilization", color: "bg-red-50 border-red-200 text-red-800" },
              { level: "Inpatient", desc: "24/7 hospital-based treatment", color: "bg-orange-50 border-orange-200 text-orange-800" },
              { level: "Residential", desc: "Live-in treatment facility", color: "bg-amber-50 border-amber-200 text-amber-800" },
              { level: "PHP", desc: "Partial hospitalization, 5-7 days/week", color: "bg-yellow-50 border-yellow-200 text-yellow-800" },
              { level: "IOP", desc: "Intensive outpatient, 3-5 days/week", color: "bg-teal-50 border-teal-200 text-teal-800" },
              { level: "Outpatient", desc: "Regular therapy sessions", color: "bg-green-50 border-green-200 text-green-800" },
            ].map((item) => (
              <button
                key={item.level}
                onClick={() => setLocation(`/search?levelOfCare=${item.level.toLowerCase()}`)}
                className={`text-left p-4 rounded-xl border ${item.color} hover:shadow-md transition-all`}
              >
                <div className="font-semibold mb-1">{item.level}</div>
                <div className="text-sm opacity-80">{item.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-lg text-card-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 text-center">
      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </div>
      <div className="font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
