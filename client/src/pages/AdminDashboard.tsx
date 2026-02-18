import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  Database,
  Download,
  RefreshCw,
  Plus,
  Loader2,
  Building2,
  FileText,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  Heart,
  Activity,
  Globe,
  MapPin,
  Star,
  Eye,
  BarChart3,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Merge,
  SkipForward,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

type AdminTab = "overview" | "ingest" | "jobs" | "stale" | "review" | "quality";

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ tab?: string }>();
  const currentTab = (params.tab ?? "overview") as AdminTab;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sign In Required</h2>
            <p className="text-muted-foreground mb-4">
              You need to sign in to access the admin dashboard.
            </p>
            <Button onClick={() => (window.location.href = getLoginUrl())}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don't have admin privileges to access this page.
            </p>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r hidden lg:block">
        <div className="p-4 border-b">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-serif font-bold text-foreground">ClearPath</span>
          </Link>
          <p className="text-xs text-muted-foreground mt-1">Admin Dashboard</p>
        </div>
        <nav className="p-2 space-y-0.5">
          <SidebarLink href="/admin/overview" active={currentTab === "overview"} icon={<LayoutDashboard className="w-4 h-4" />}>
            Overview
          </SidebarLink>
          <SidebarLink href="/admin/ingest" active={currentTab === "ingest"} icon={<Download className="w-4 h-4" />}>
            Ingest Data
          </SidebarLink>
          <SidebarLink href="/admin/jobs" active={currentTab === "jobs"} icon={<Activity className="w-4 h-4" />}>
            Jobs Queue
          </SidebarLink>
          <SidebarLink href="/admin/review" active={currentTab === "review"} icon={<Eye className="w-4 h-4" />}>
            Review Queue
          </SidebarLink>
          <SidebarLink href="/admin/quality" active={currentTab === "quality"} icon={<BarChart3 className="w-4 h-4" />}>
            Quality Metrics
          </SidebarLink>
          <SidebarLink href="/admin/stale" active={currentTab === "stale"} icon={<AlertTriangle className="w-4 h-4" />}>
            Stale Entities
          </SidebarLink>
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50 flex">
        <MobileTab href="/admin/overview" active={currentTab === "overview"} icon={<LayoutDashboard className="w-5 h-5" />} label="Overview" />
        <MobileTab href="/admin/ingest" active={currentTab === "ingest"} icon={<Download className="w-5 h-5" />} label="Ingest" />
        <MobileTab href="/admin/jobs" active={currentTab === "jobs"} icon={<Activity className="w-5 h-5" />} label="Jobs" />
        <MobileTab href="/admin/review" active={currentTab === "review"} icon={<Eye className="w-5 h-5" />} label="Review" />
        <MobileTab href="/admin/quality" active={currentTab === "quality"} icon={<BarChart3 className="w-5 h-5" />} label="Quality" />
        <MobileTab href="/admin/stale" active={currentTab === "stale"} icon={<AlertTriangle className="w-5 h-5" />} label="Stale" />
      </div>

      {/* Main content */}
      <main className="flex-1 p-6 pb-20 lg:pb-6 overflow-auto">
        {currentTab === "overview" && <OverviewTab />}
        {currentTab === "ingest" && <IngestTab />}
        {currentTab === "jobs" && <JobsTab />}
        {currentTab === "review" && <ReviewQueueTab />}
        {currentTab === "quality" && <QualityMetricsTab />}
        {currentTab === "stale" && <StaleTab />}
      </main>
    </div>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab() {
  const { data, isLoading } = trpc.admin.stats.useQuery();
  const utils = trpc.useUtils();

  const computeQuality = trpc.admin.computeQuality.useMutation({
    onSuccess: (data) => {
      toast.success(`Quality computation job #${data.jobId} created`);
      utils.admin.stats.invalidate();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard Overview</h1>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => computeQuality.mutate()}
          disabled={computeQuality.isPending}
        >
          {computeQuality.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Recompute Quality
        </Button>
      </div>

      {/* Entity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <StatCard icon={<Building2 className="w-5 h-5" />} label="Organizations" value={data.entities.organizations} />
        <StatCard icon={<MapPin className="w-5 h-5" />} label="Facilities" value={data.entities.facilities} />
        <StatCard icon={<FileText className="w-5 h-5" />} label="Programs" value={data.entities.programs} />
        <StatCard icon={<Globe className="w-5 h-5" />} label="Sources" value={data.entities.sources} />
        <StatCard icon={<Shield className="w-5 h-5" />} label="Assertions" value={data.entities.assertions} />
      </div>

      {/* Job Stats */}
      <h2 className="text-lg font-semibold text-foreground mb-4">Ingestion Queue</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <JobStatCard label="Pending" value={data.jobs.pending} color="text-amber-600 bg-amber-50" />
        <JobStatCard label="Running" value={data.jobs.running} color="text-blue-600 bg-blue-50" />
        <JobStatCard label="Completed" value={data.jobs.completed} color="text-green-600 bg-green-50" />
        <JobStatCard label="Failed" value={data.jobs.failed} color="text-red-600 bg-red-50" />
      </div>

      {/* Review & Quality Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {data.review && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="w-5 h-5 text-primary" /> Review Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-amber-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-amber-600">{data.review.pending ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">{data.review.inReview ?? 0}</div>
                  <div className="text-xs text-muted-foreground">In Review</div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">{data.review.total ?? 0}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg text-center">
                  <div className="text-2xl font-bold text-gray-600">{Object.keys(data.review.byType ?? {}).length}</div>
                  <div className="text-xs text-muted-foreground">Review Types</div>
                </div>
              </div>
              <Link href="/admin/review" className="text-sm text-primary hover:underline mt-3 block">
                View review queue →
              </Link>
            </CardContent>
          </Card>
        )}

        {data.quality && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Star className="w-5 h-5 text-primary" /> Quality Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <QualityBar label="Avg Quality Score" score={data.quality.avgQuality ?? 0} />
              <QualityBar label="Avg Completeness" score={data.quality.avgCompleteness ?? 0} />
              <QualityBar label="Avg Freshness" score={data.quality.avgFreshness ?? 0} />
              <QualityBar label="Validation Pass Rate" score={data.quality.validationPassRate ?? 0} />
              <Link href="/admin/quality" className="text-sm text-primary hover:underline block">
                View quality details →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Ingest Tab
// ============================================================================

function IngestTab() {
  const [url, setUrl] = useState("");
  const [jobType, setJobType] = useState<"ingest_seed_url" | "crawl_domain">("ingest_seed_url");
  const utils = trpc.useUtils();

  const ingestMutation = trpc.admin.ingest.useMutation({
    onSuccess: (data) => {
      toast.success(`Ingestion job #${data.jobId} created`);
      setUrl("");
      utils.admin.stats.invalidate();
      utils.admin.jobs.invalidate();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    ingestMutation.mutate({ url: url.trim(), jobType });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-2">Ingest Data</h1>
      <p className="text-muted-foreground mb-6">
        Add treatment provider URLs to crawl and extract program data.
      </p>

      <Card className="max-w-xl">
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">URL</label>
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example-treatment-center.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Job Type</label>
              <Select value={jobType} onValueChange={(v) => setJobType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingest_seed_url">Single Page Ingest</SelectItem>
                  <SelectItem value="crawl_domain">Crawl Domain (multiple pages)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {jobType === "ingest_seed_url"
                  ? "Extract data from a single URL"
                  : "Crawl the domain and extract from treatment-related pages"}
              </p>
            </div>
            <Button type="submit" disabled={ingestMutation.isPending} className="gap-2">
              {ingestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Start Ingestion
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="mt-8">
        <h3 className="font-semibold text-foreground mb-3">Suggested Seed URLs</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Click to auto-fill the URL field with common treatment directories.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            "https://www.hazeldenbettyford.org",
            "https://www.caron.org",
            "https://www.promises.com",
            "https://www.therecoveryvillage.com",
            "https://www.americanaddictioncenters.org",
          ].map((seedUrl) => (
            <button
              key={seedUrl}
              onClick={() => setUrl(seedUrl)}
              className="text-xs px-3 py-1.5 rounded-full border hover:border-primary/30 hover:bg-primary/5 transition-colors"
            >
              {new URL(seedUrl).hostname}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Jobs Tab
// ============================================================================

function JobsTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const filters = useMemo(() => ({ status: statusFilter || undefined, limit: 50 }), [statusFilter]);
  const { data, isLoading, refetch } = trpc.admin.jobs.useQuery(filters);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Jobs Queue</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !data || data.jobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Database className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No jobs found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.total} total job{data.total !== 1 ? "s" : ""}</p>
          {data.jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">#{job.id}</span>
                      <JobStatusBadge status={job.status} />
                      <Badge variant="outline" className="text-xs">{job.jobType.replace(/_/g, " ")}</Badge>
                    </div>
                    {job.payload && (
                      <p className="text-sm text-muted-foreground truncate">
                        {(job.payload as any).url || (job.payload as any).domain || JSON.stringify(job.payload)}
                      </p>
                    )}
                    {job.errorMessage && (
                      <p className="text-sm text-destructive mt-1 truncate">{job.errorMessage}</p>
                    )}
                    {job.result && (
                      <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                        {(job.result as any).pagesProcessed !== undefined && <span>Pages: {(job.result as any).pagesProcessed}</span>}
                        {(job.result as any).entitiesCreated !== undefined && <span>Created: {(job.result as any).entitiesCreated}</span>}
                        {(job.result as any).assertionsCreated !== undefined && <span>Assertions: {(job.result as any).assertionsCreated}</span>}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground text-right shrink-0">
                    <div>{new Date(job.createdAt).toLocaleString()}</div>
                    <div>Attempts: {job.attempts}/{job.maxAttempts}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Review Queue Tab
// ============================================================================

function ReviewQueueTab() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const filters = useMemo(() => ({ status: statusFilter || undefined, limit: 50 }), [statusFilter]);
  const { data, isLoading, refetch } = trpc.admin.reviewQueue.useQuery(filters);
  const utils = trpc.useUtils();

  const resolveMutation = trpc.admin.resolveReview.useMutation({
    onSuccess: () => {
      toast.success("Review item resolved");
      utils.admin.reviewQueue.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
          <p className="text-sm text-muted-foreground">Review and approve extracted data before it goes live.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-muted-foreground">No items in the review queue</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{data.total} total item{data.total !== 1 ? "s" : ""}</p>
          {data.items.map((item: any) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm font-medium">#{item.id}</span>
                      <ReviewStatusBadge status={item.status} />
                      <Badge variant="outline" className="text-xs capitalize">{item.reviewType?.replace(/_/g, " ") ?? "review"}</Badge>
                      {item.priority && (
                        <PriorityBadge priority={item.priority} />
                      )}
                    </div>
                    <p className="text-sm text-foreground mb-1">
                      {item.entityType} #{item.entityId}
                    </p>
                    {item.reason && (
                      <p className="text-sm text-muted-foreground">{item.reason}</p>
                    )}
                    {item.payload && (
                      <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono text-muted-foreground max-h-24 overflow-auto">
                        {typeof item.payload === "string" ? item.payload : JSON.stringify(item.payload, null, 2)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {item.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1"
                          onClick={() => resolveMutation.mutate({ id: item.id, resolution: "approved" })}
                          disabled={resolveMutation.isPending}
                        >
                          <ThumbsUp className="w-3 h-3" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1"
                          onClick={() => resolveMutation.mutate({ id: item.id, resolution: "rejected" })}
                          disabled={resolveMutation.isPending}
                        >
                          <ThumbsDown className="w-3 h-3" /> Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => resolveMutation.mutate({ id: item.id, resolution: "skipped" })}
                          disabled={resolveMutation.isPending}
                        >
                          <SkipForward className="w-3 h-3" /> Skip
                        </Button>
                      </>
                    )}
                    <div className="text-xs text-muted-foreground text-right mt-1">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Quality Metrics Tab
// ============================================================================

function QualityMetricsTab() {
  const { data, isLoading } = trpc.admin.qualityMetrics.useQuery();
  const utils = trpc.useUtils();

  const computeQuality = trpc.admin.computeQuality.useMutation({
    onSuccess: (data) => {
      toast.success(`Quality computation job #${data.jobId} created`);
      utils.admin.qualityMetrics.invalidate();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quality Metrics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor data quality across the platform.
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => computeQuality.mutate()}
          disabled={computeQuality.isPending}
        >
          {computeQuality.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Recompute Scores
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Quality</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QualityBar label="Average Quality" score={data.avgQuality ?? 0} />
            <QualityBar label="Completeness" score={data.avgCompleteness ?? 0} />
            <QualityBar label="Freshness" score={data.avgFreshness ?? 0} />
            <QualityBar label="Validation Pass Rate" score={data.validationPassRate ?? 0} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quality Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.distribution && data.distribution.length > 0 ? (
              data.distribution.map((d: any) => (
                <div key={d.bucket} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground capitalize">{d.bucket} Quality</span>
                  <span className={`font-medium ${
                    d.bucket === 'high' ? 'text-green-600' : d.bucket === 'medium' ? 'text-amber-600' : d.bucket === 'low' ? 'text-red-600' : 'text-muted-foreground'
                  }`}>{d.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No quality data yet. Run quality computation first.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Quality scores are computed from confidence, completeness, freshness, and validation pass rates.
            </p>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => computeQuality.mutate()}
              disabled={computeQuality.isPending}
            >
              {computeQuality.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Recompute All Scores
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================================
// Stale Tab
// ============================================================================

function StaleTab() {
  const { data, isLoading } = trpc.admin.staleEntities.useQuery({ days: 120 });
  const utils = trpc.useUtils();

  const refreshMutation = trpc.admin.refreshStale.useMutation({
    onSuccess: (data) => {
      toast.success(`Refresh job #${data.jobId} created`);
      utils.admin.stats.invalidate();
      utils.admin.jobs.invalidate();
    },
    onError: (error) => toast.error(`Failed: ${error.message}`),
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stale Entities</h1>
          <p className="text-muted-foreground text-sm">Programs not verified in the last 120 days</p>
        </div>
        <Button
          onClick={() => refreshMutation.mutate({ days: 120 })}
          disabled={refreshMutation.isPending}
          className="gap-2"
        >
          {refreshMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh All
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-3" />
            <p className="text-muted-foreground">All entities are up to date</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((entity: any) => (
            <Card key={entity.program.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-foreground">{entity.program.name}</h4>
                    {entity.facility && (
                      <p className="text-sm text-muted-foreground">
                        {entity.facility.name} · {entity.facility.city}, {entity.facility.state}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Last verified: {entity.program.lastVerifiedAt ? new Date(entity.program.lastVerifiedAt).toLocaleDateString() : "Never"}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Stale
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SidebarLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors no-underline ${
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

function MobileTab({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs no-underline transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
          <div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JobStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-4 text-center">
        <div className={`text-3xl font-bold ${color.split(" ")[0]}`}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </CardContent>
    </Card>
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
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    case "running":
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Running</Badge>;
    case "completed":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-600 border-red-200 hover:bg-red-100 gap-1"><XCircle className="w-3 h-3" /> Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function ReviewStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 gap-1"><Clock className="w-3 h-3" /> Pending</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100 gap-1"><CheckCircle2 className="w-3 h-3" /> Approved</Badge>;
    case "rejected":
      return <Badge className="bg-red-100 text-red-600 border-red-200 hover:bg-red-100 gap-1"><XCircle className="w-3 h-3" /> Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "critical":
      return <Badge className="bg-red-100 text-red-600 border-red-200 text-[10px] px-1.5 py-0">Critical</Badge>;
    case "high":
      return <Badge className="bg-orange-100 text-orange-600 border-orange-200 text-[10px] px-1.5 py-0">High</Badge>;
    case "medium":
      return <Badge className="bg-amber-100 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">Medium</Badge>;
    case "low":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] px-1.5 py-0">Low</Badge>;
    default:
      return null;
  }
}
