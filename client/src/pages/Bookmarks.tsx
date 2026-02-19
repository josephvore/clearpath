import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bookmark,
  BookmarkX,
  Loader2,
  MapPin,
  Building2,
  Phone,
  Video,
  Star,
  Shield,
  ChevronRight,
  LogIn,
  Heart,
  GitCompareArrows,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { formatLevelOfCare, getConfidenceLabel } from "@shared/types";
import { getLoginUrl } from "@/const";

export default function BookmarksPage() {
  const { user, loading: authLoading } = useAuth();
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const { data: bookmarks, isLoading, refetch } = trpc.bookmarks.list.useQuery(undefined, {
    enabled: !!user,
  });

  const removeMutation = trpc.bookmarks.remove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const toggleCompare = (id: number) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <LogIn className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Sign in to save and manage your bookmarked programs.
        </p>
        <Button asChild>
          <a href={getLoginUrl()}>Sign In</a>
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
        <span className="text-muted-foreground">Loading bookmarks...</span>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bookmark className="w-6 h-6 text-primary" />
                My Saved Programs
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {bookmarks?.length ?? 0} program{(bookmarks?.length ?? 0) !== 1 ? "s" : ""} saved
              </p>
            </div>
            {compareIds.length >= 2 && (
              <Button asChild>
                <Link href={`/compare?ids=${compareIds.join(",")}`}>
                  <GitCompareArrows className="w-4 h-4 mr-2" />
                  Compare {compareIds.length} Programs
                </Link>
              </Button>
            )}
          </div>
          {compareIds.length > 0 && compareIds.length < 2 && (
            <p className="text-xs text-muted-foreground mt-2">
              Select at least 2 programs to compare (up to 4)
            </p>
          )}
        </div>
      </div>

      <div className="container py-6">
        {!bookmarks || bookmarks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Heart className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Saved Programs Yet</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Browse treatment programs and click the bookmark icon to save them here for easy comparison.
            </p>
            <div className="flex gap-3 justify-center">
              <Button asChild>
                <Link href="/search">Browse Programs</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/find">Guided Finder</Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {bookmarks.map((bm: any) => (
              <Card key={bm.bookmark.id} className="hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Compare checkbox */}
                    <div className="pt-1">
                      <button
                        onClick={() => toggleCompare(bm.program.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          compareIds.includes(bm.program.id)
                            ? "bg-primary border-primary text-white"
                            : "border-muted-foreground/30 hover:border-primary"
                        }`}
                        title="Select for comparison"
                      >
                        {compareIds.includes(bm.program.id) && (
                          <GitCompareArrows className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Program info */}
                    <Link href={`/program/${bm.program.id}`} className="flex-1 min-w-0 no-underline group">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-xs shrink-0 border-primary/30 text-primary">
                          {formatLevelOfCare(bm.program.levelOfCare)}
                        </Badge>
                        {bm.program.telehealthAvailable && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Video className="w-3 h-3" /> Telehealth
                          </Badge>
                        )}
                        {(bm.facility?.qualityScore ?? bm.program?.qualityScore) != null && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Star className="w-3 h-3" />{" "}
                            {getConfidenceLabel(bm.facility?.qualityScore ?? bm.program?.qualityScore)} Quality
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                        {bm.program.name}
                      </h3>
                      {bm.organization && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3.5 h-3.5 shrink-0" /> {bm.organization.name}
                        </p>
                      )}
                      {bm.facility && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />{" "}
                          {[bm.facility.city, bm.facility.state].filter(Boolean).join(", ")}
                        </p>
                      )}
                      {bm.program.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{bm.program.description}</p>
                      )}

                      {bm.facility?.acceptedInsurance?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {bm.facility.acceptedInsurance.slice(0, 3).map((ins: string) => (
                            <Badge key={ins} variant="outline" className="text-[10px] px-1.5 py-0 border-green-300 text-green-700">
                              <Shield className="w-2.5 h-2.5 mr-0.5" /> {ins}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {bm.facility?.phone && (
                        <p className="text-sm text-primary flex items-center gap-1 mt-2">
                          <Phone className="w-3.5 h-3.5" /> {bm.facility.phone}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        Saved {new Date(bm.bookmark.createdAt).toLocaleDateString()}
                      </p>
                    </Link>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeMutation.mutate({ programId: bm.program.id })}
                        disabled={removeMutation.isPending}
                        title="Remove bookmark"
                      >
                        <BookmarkX className="w-4 h-4" />
                      </Button>
                      <Link href={`/program/${bm.program.id}`}>
                        <Button variant="ghost" size="icon" title="View details">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
