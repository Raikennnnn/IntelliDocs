import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Gift,
  Search,
  RefreshCw,
  Loader2,
  Plus,
  CheckCircle,
  Banknote,
  Ban,
  GraduationCap,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { useSchoolYear } from "../../context/SchoolYearContext";
import { toast } from "sonner";
import {
  fetchReferralLedger,
  postReferralLedgerAction,
  REFERRAL_PAGE_SIZE_OPTIONS,
  type ReferralLedgerClaim,
  type ReferralLedgerStats,
} from "../../lib/referralLedgerApi";

const emptyStats: ReferralLedgerStats = {
  total: 0,
  preissued: 0,
  freebieEligible: 0,
  freebieGiven: 0,
  incentiveEligible: 0,
  incentivePaid: 0,
  voided: 0,
};

function freebieBadgeClass(status: string): string {
  switch (status) {
    case "given":
      return "bg-green-600";
    case "eligible":
      return "bg-blue-600";
    case "void":
      return "bg-gray-500";
    default:
      return "bg-amber-600";
  }
}

function incentiveBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-green-600";
    case "eligible":
      return "bg-blue-600";
    case "void":
      return "bg-gray-500";
    default:
      return "bg-amber-600";
  }
}

export function ReferralLedger() {
  const { enrollmentSchoolYearLabel } = useSchoolYear();
  const [claims, setClaims] = useState<ReferralLedgerClaim[]>([]);
  const [stats, setStats] = useState<ReferralLedgerStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [freebieFilter, setFreebieFilter] = useState("");
  const [incentiveFilter, setIncentiveFilter] = useState("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [page, setPage] = useState(1);
  const [matched, setMatched] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const [preissueOpen, setPreissueOpen] = useState(false);
  const [preissueCount, setPreissueCount] = useState("10");
  const [preissueStart, setPreissueStart] = useState("");
  const [preissueBusy, setPreissueBusy] = useState(false);

  const [voidOpen, setVoidOpen] = useState(false);
  const [voidTarget, setVoidTarget] = useState<ReferralLedgerClaim | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const schoolYear = enrollmentSchoolYearLabel ?? "";

  const loadLedger = useCallback(async () => {
    if (!schoolYear) {
      setClaims([]);
      setStats(emptyStats);
      setMatched(0);
      setTotalPages(1);
      setLoading(false);
      setError("No active enrollment school year.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchReferralLedger({
        schoolYear,
        search: search.trim(),
        freebieStatus: freebieFilter,
        incentiveStatus: incentiveFilter,
        limit: pageSize,
        page,
      });
      if (!json.success) {
        throw new Error(json.error || "Failed to load referral ledger");
      }
      setClaims(Array.isArray(json.claims) ? json.claims : []);
      setStats(json.stats ?? emptyStats);
      setMatched(json.matched ?? 0);
      setTotalPages(Math.max(1, json.totalPages ?? 1));
      if (json.page && json.page !== page) {
        setPage(json.page);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load referral ledger");
      setClaims([]);
      setStats(emptyStats);
      setMatched(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [schoolYear, search, freebieFilter, incentiveFilter, pageSize, page]);

  useEffect(() => {
    setPage(1);
  }, [search, freebieFilter, incentiveFilter, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLedger();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadLedger]);

  const runAction = async (
    claimId: number,
    action: "mark_freebie_given" | "mark_first_semester_complete" | "mark_incentive_paid",
  ) => {
    setActionBusyId(claimId);
    try {
      const json = await postReferralLedgerAction(action, { claim_id: claimId, school_year: schoolYear });
      if (!json.success) {
        throw new Error(json.error || "Action failed");
      }
      toast.success(json.message || "Updated");
      await loadLedger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActionBusyId(null);
    }
  };

  const handlePreissue = async () => {
    const count = Number.parseInt(preissueCount, 10);
    if (!Number.isFinite(count) || count < 1 || count > 500) {
      toast.error("Enter a count between 1 and 500.");
      return;
    }
    setPreissueBusy(true);
    try {
      const json = await postReferralLedgerAction("preissue", {
        school_year: schoolYear,
        count,
        ...(preissueStart.trim() ? { start_control: preissueStart.trim() } : {}),
      });
      if (!json.success) {
        throw new Error(json.error || "Pre-issue failed");
      }
      const issued = json.controlNumbers ?? [];
      toast.success(
        issued.length > 0
          ? `Pre-issued ${issued.length} control number(s): ${issued[0]}–${issued[issued.length - 1]}`
          : "Control numbers pre-issued.",
      );
      setPreissueOpen(false);
      setPreissueStart("");
      await loadLedger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pre-issue failed");
    } finally {
      setPreissueBusy(false);
    }
  };

  const handleVoid = async () => {
    if (!voidTarget) return;
    if (!voidReason.trim()) {
      toast.error("Please enter a void reason.");
      return;
    }
    setActionBusyId(voidTarget.id);
    try {
      const json = await postReferralLedgerAction("void", {
        claim_id: voidTarget.id,
        void_reason: voidReason.trim(),
        school_year: schoolYear,
      });
      if (!json.success) {
        throw new Error(json.error || "Void failed");
      }
      toast.success("Referral claim voided.");
      setVoidOpen(false);
      setVoidTarget(null);
      setVoidReason("");
      await loadLedger();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Void failed");
    } finally {
      setActionBusyId(null);
    }
  };

  const statCards = useMemo(
    () => [
      { label: "Total cards", value: stats.total },
      { label: "Pre-issued", value: stats.preissued },
      { label: "Freebie eligible", value: stats.freebieEligible, className: "text-blue-600" },
      { label: "Freebie given", value: stats.freebieGiven, className: "text-green-600" },
      { label: "₱500 eligible", value: stats.incentiveEligible, className: "text-blue-600" },
      { label: "₱500 paid", value: stats.incentivePaid, className: "text-green-600" },
      { label: "Voided", value: stats.voided, className: "text-gray-600" },
    ],
    [stats],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Gift className="w-7 h-7 text-[#8B1538]" />
            Bring a Friend Ledger
          </h2>
          <p className="text-gray-600 mt-1">
            Track referral cards, enrollment freebies, and ₱500 referrer incentives for{" "}
            <span className="font-medium">{schoolYear || "—"}</span>.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadLedger()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setPreissueOpen(true)} disabled={!schoolYear}>
            <Plus className="w-4 h-4 mr-2" />
            Pre-issue cards
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className={`text-xl font-bold ${card.className ?? "text-gray-900"}`}>{card.value}</p>
              <p className="text-xs text-gray-600 mt-1">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Filters</CardTitle>
          <CardDescription>Search by control number, referrer, or referred student name.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search control #, referrer, student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={freebieFilter}
              onChange={(e) => setFreebieFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All freebie statuses</option>
              <option value="pending">Freebie pending</option>
              <option value="eligible">Freebie eligible</option>
              <option value="given">Freebie given</option>
              <option value="void">Freebie void</option>
            </select>
            <select
              value={incentiveFilter}
              onChange={(e) => setIncentiveFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All incentive statuses</option>
              <option value="pending">Incentive pending</option>
              <option value="eligible">Incentive eligible</option>
              <option value="paid">Incentive paid</option>
              <option value="void">Incentive void</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                aria-label="Rows per page"
              >
                {REFERRAL_PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>per page</span>
            </div>
            <p className="text-sm text-gray-600">
              {matched === 0
                ? "0 results"
                : `Showing ${Math.min((page - 1) * pageSize + 1, matched)}–${Math.min(page * pageSize, matched)} of ${matched}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading ledger...
            </div>
          ) : claims.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              No referral claims found for this school year.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Control #</TableHead>
                    <TableHead>Referred student</TableHead>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Freebie</TableHead>
                    <TableHead>₱500 incentive</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => {
                    const busy = actionBusyId === claim.id;
                    const isVoid = claim.referredFreebieStatus === "void" || claim.referrerIncentiveStatus === "void";
                    const canMarkFreebie =
                      !isVoid &&
                      claim.enrollmentId &&
                      ["eligible", "pending"].includes(claim.referredFreebieStatus);
                    const canMarkFirstSem =
                      !isVoid &&
                      claim.enrollmentId &&
                      claim.referrerIncentiveStatus === "pending";
                    const canMarkPaid = !isVoid && claim.referrerIncentiveStatus === "eligible";
                    const canVoid = !isVoid && claim.referrerIncentiveStatus !== "paid";

                    return (
                      <TableRow key={claim.id}>
                        <TableCell className="font-mono font-semibold">{claim.controlNumber}</TableCell>
                        <TableCell>
                          {claim.isPreissued ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              Pre-issued
                            </Badge>
                          ) : claim.enrollmentId ? (
                            <div>
                              <p className="font-medium">{claim.referredStudentName || "—"}</p>
                              <Link
                                to={`/registrar/review-documents/${claim.enrollmentId}`}
                                className="text-xs text-[#8B1538] hover:underline inline-flex items-center gap-1"
                              >
                                {claim.applicationId || `Enrollment #${claim.enrollmentId}`}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          ) : (
                            <span className="text-gray-500">Unlinked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">
                            {claim.isPreissued ? "—" : claim.referrerName}
                          </p>
                          {!claim.isPreissued && (
                            <p className="text-xs text-gray-500">
                              {claim.referrerTypeLabel} · {claim.referrerContactNumber}
                              {claim.referrerEmail ? ` · ${claim.referrerEmail}` : ''}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={freebieBadgeClass(claim.referredFreebieStatus)}>
                            {claim.referredFreebieStatusLabel}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={incentiveBadgeClass(claim.referrerIncentiveStatus)}>
                            {claim.referrerIncentiveStatusLabel}
                          </Badge>
                          {claim.firstSemesterCompletedAt && (
                            <p className="text-xs text-gray-500 mt-1">1st sem: {claim.firstSemesterCompletedAt.slice(0, 10)}</p>
                          )}
                          {claim.voidReason && (
                            <p className="text-xs text-red-600 mt-1">{claim.voidReason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            {canMarkFreebie && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void runAction(claim.id, "mark_freebie_given")}
                              >
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Freebie given
                              </Button>
                            )}
                            {canMarkFirstSem && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void runAction(claim.id, "mark_first_semester_complete")}
                              >
                                <GraduationCap className="w-3.5 h-3.5 mr-1" />
                                1st sem done
                              </Button>
                            )}
                            {canMarkPaid && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void runAction(claim.id, "mark_incentive_paid")}
                              >
                                <Banknote className="w-3.5 h-3.5 mr-1" />
                                Mark paid
                              </Button>
                            )}
                            {canVoid && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-700 border-red-200 hover:bg-red-50"
                                disabled={busy}
                                onClick={() => {
                                  setVoidTarget(claim);
                                  setVoidReason("");
                                  setVoidOpen(true);
                                }}
                              >
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                Void
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && matched > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
              <p className="text-sm text-gray-600">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={preissueOpen} onOpenChange={setPreissueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pre-issue referral cards</DialogTitle>
            <DialogDescription>
              Creates unused control numbers for {schoolYear}. Numbers are one-time use and continue from the
              highest existing number unless you set a custom start.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="preissue-count">
                How many cards?
              </label>
              <Input
                id="preissue-count"
                inputMode="numeric"
                value={preissueCount}
                onChange={(e) => setPreissueCount(e.target.value)}
                placeholder="10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="preissue-start">
                Start at control # (optional)
              </label>
              <Input
                id="preissue-start"
                inputMode="numeric"
                maxLength={4}
                value={preissueStart}
                onChange={(e) => setPreissueStart(e.target.value)}
                placeholder="0001"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreissueOpen(false)} disabled={preissueBusy}>
              Cancel
            </Button>
            <Button onClick={() => void handlePreissue()} disabled={preissueBusy}>
              {preissueBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Pre-issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void referral claim</DialogTitle>
            <DialogDescription>
              Voids both the referred freebie and referrer incentive for control #
              {voidTarget?.controlNumber}. Use when the referred student drops out before 1st semester, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium" htmlFor="void-reason">
              Reason
            </label>
            <Input
              id="void-reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Referred student dropped out before 1st semester"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleVoid()} disabled={actionBusyId !== null}>
              Void claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
