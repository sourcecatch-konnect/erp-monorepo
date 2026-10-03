import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListQuery,
  type ListResult,
} from "@/features/masters/_shared/master-api";

export type PaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";
export type DriverFinanceEntryStatus = "POSTED" | "REVERSED";
export type DriverPayoutSource = "SALARY_RUN" | "LOG_SLIP" | "MANUAL";

type NamedUser = { id: string; firstName: string; lastName: string } | null;
type Named = { id: string; name: string };

type EntryCommon = {
  id: string;
  driverId: string;
  branchId: string;
  fyCode: string;
  amountPaise: string;
  paidAt: string;
  mode: PaymentMode;
  referenceNo: string | null;
  status: DriverFinanceEntryStatus;
  journalEntryId: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  createdAt: string;
  driver: Named;
  branch: { id: string; name: string; branchCode: string };
  fundingLedger: Named;
  createdBy: NamedUser;
  reversedBy: NamedUser;
};

export type DriverSalaryAdvance = EntryCommon & {
  advanceNumber: string;
  reason: string | null;
};

export type DriverPayout = EntryCommon & {
  payoutNumber: string;
  source: DriverPayoutSource;
  logSlip: { id: string; logSlipNumber: string | null; journeyId: string } | null;
  salaryRun: { id: string; runNumber: string; month: string } | null;
};

/** Signed: positive = the driver owes us, negative = we owe the driver. */
export type DriverBalance = {
  driver: Named;
  ledgerId: string | null;
  /** Counted from `startDate` — older driver money was settled outside the ERP. */
  balancePaise: string;
  startDate: string;
  /** Approved salary not yet paid — paid from its salary run, not manually. */
  salaryDue: { amountPaise: string; runNumbers: string[] };
  /** Most recent posted log slips that still show money owed to the driver. */
  unpaidLogSlips: {
    items: Array<{
      id: string;
      logSlipNumber: string | null;
      journeyId: string;
      logSlipDate: string;
      remainingPaise: string;
    }>;
    count: number;
  };
};

export type LogSlipPayoutStatus = {
  logSlipId: string;
  logSlipNumber: string | null;
  logSlipDate: string;
  status: string;
  driver: Named;
  branchId: string;
  postedToAccounts: boolean;
  /** Dated before `startDate` — paid outside the ERP; nothing left to pay here. */
  settledBeforeStart: boolean;
  startDate: string;
  /** An approved salary run already counted this log slip in net pay. */
  settledBySalaryRun: { id: string; runNumber: string; month: string } | null;
  payablePaise: string;
  paidPaise: string;
  remainingPaise: string;
  payouts: Array<{
    id: string;
    payoutNumber: string;
    amountPaise: string;
    paidAt: string;
    mode: PaymentMode;
    journalEntryId: string | null;
  }>;
};

export type DriverStatementKind =
  | "LOG_SLIP"
  | "SALARY_ADVANCE"
  | "PAYMENT"
  | "SALARY"
  | "REVERSAL"
  | "OTHER";

/** Running balance signed: positive = the driver owes us (Dr). */
export type DriverStatement = {
  driver: { id: string; name: string; licenseNo: string | null; licenseExpiryDate: string | null };
  startDate: string;
  openingBalancePaise: number;
  closingBalancePaise: number;
  totals: { debitPaise: number; creditPaise: number };
  lines: Array<{
    id: string;
    journalEntryId: string;
    date: string;
    kind: DriverStatementKind;
    particulars: string;
    voucherNumber: string | null;
    href: string | null;
    debitPaise: number;
    creditPaise: number;
    runningBalancePaise: number;
  }>;
};

/** A driver who has left but whose account is not settled (G9). */
export type LeftDriverBalance = {
  driverId: string;
  name: string;
  leavingDate: string;
  /** Signed: positive = the driver owes us, negative = we owe him. */
  balancePaise: string;
  /** Part of "we owe" that is approved salary — paid from its salary run. */
  salaryDuePaise: string;
  salaryRuns: string[];
};

/** A cash / bank account and its balance in the ERP (incl. opening balance). */
export type FundingAccount = {
  id: string;
  name: string;
  group: "CASH" | "BANK";
  balancePaise: string;
  hasOpeningBalance: boolean;
};

export type DriverSalaryRunStatus ="DRAFT" | "APPROVED" | "PAID" | "CANCELLED";

export type DriverSalaryRunSummary = {
  id: string;
  runNumber: string;
  month: string;
  monthLabel: string;
  daysInMonth: number;
  status: DriverSalaryRunStatus;
  totalEarnedPaise: string;
  totalNetPaise: string;
  paidPaise: string;
  createdAt: string;
  version: number;
  branch: { id: string; name: string; branchCode: string };
  _count?: { salaries: number };
};

/** One driver's line. Balances are signed: positive = the driver owes us. */
export type DriverSalaryLine = {
  id: string;
  driverId: string;
  driver: Named & { joiningDate: string | null; leavingDate: string | null };
  baseSalaryPaise: string;
  absentDays: number;
  presentDays: number;
  earnedPaise: string;
  salaryAdvancePaise: string;
  logSlipBalancePaise: string;
  otherPaymentsPaise: string;
  previousBalancePaise: string;
  netPaise: string;
  remarks: string | null;
  /** Paid so far from this run. */
  paidPaise: string;
  /** Vehicle(s) the driver drove during the month. */
  vehicles: string[];
  /** Days on a journey this month — a hint for absent days, not used in pay. */
  journeyDays: number;
  /** Payments made from this run to this driver, with the account used. */
  payouts: Array<{
    id: string;
    payoutNumber: string;
    amountPaise: string;
    paidAt: string;
    mode: PaymentMode;
    status: DriverFinanceEntryStatus;
    journalEntryId: string | null;
    fundingLedger: { id: string; name: string };
  }>;
};

export type DriverSalaryRun = DriverSalaryRunSummary & {
  /** YYYY-MM-DD — the month's last day; approval opens then. */
  approvableFrom: string;
  canApproveNow: boolean;
  /** Posted payments from this run, totalled per cash / bank account. */
  paidFrom: Array<{ name: string; amountPaise: string; count: number }>;
  journalEntryId: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdBy: NamedUser;
  approvedBy: NamedUser;
  cancelledBy: NamedUser;
  salaries: DriverSalaryLine[];
};

export type SalaryRunLineEdit = {
  driverId: string;
  absentDays: number;
  baseSalaryPaise: string;
  remarks?: string;
  remove?: boolean;
};

type MoneyOutBody = {
  amountPaise: string;
  paidAt: string;
  mode: PaymentMode;
  referenceNo?: string;
  fundingLedgerId: string;
  /** Generate once per attempt (crypto.randomUUID()) and reuse on retry —
   *  that is what stops a double click from paying twice. */
  clientRequestId: string;
};

export type CreateSalaryAdvanceBody = MoneyOutBody & {
  driverId: string;
  branchId: string;
  reason?: string;
};

export type CreatePayoutBody = MoneyOutBody & {
  driverId: string;
} & (
    | { source: "MANUAL"; branchId: string; logSlipId?: undefined }
    | { source: "LOG_SLIP"; logSlipId: string; branchId?: undefined }
  );

export type DriverFinanceListQuery = ListQuery & {
  driverId?: string;
  status?: DriverFinanceEntryStatus;
};

const listParams = ({ driverId, status, search, page, size }: DriverFinanceListQuery) => ({
  ...(driverId ? { driverId } : {}),
  ...(status ? { status } : {}),
  ...(search?.trim() ? { search: search.trim() } : {}),
  ...(page !== undefined ? { page } : {}),
  ...(size !== undefined ? { size } : {}),
});

const post = async <T>(url: string, body: unknown) =>
  unwrapApiResponse(await api.post<ApiResponse<T>>(url, body));

export const driverFinanceApi = {
  balance: async (driverId: string) =>
    unwrapApiResponse(
      await api.get<ApiResponse<DriverBalance>>(`/driver-finance/drivers/${driverId}/balance`),
    ),

  settings: async () =>
    unwrapApiResponse(
      await api.get<
        ApiResponse<{
          startDate: string;
          makerChecker: boolean;
          earlyApproval: boolean;
          headOffice: { id: string; name: string };
          canRunSalary: boolean;
        }>
      >("/driver-finance/settings"),
    ),

  statement: async (driverId: string, range: { from?: string; to?: string } = {}) =>
    unwrapApiResponse(
      await api.get<ApiResponse<DriverStatement>>(
        `/driver-finance/drivers/${driverId}/statement`,
        { params: { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) } },
      ),
    ),

  salaryAdvances: async (
    query: DriverFinanceListQuery = {},
  ): Promise<ListResult<DriverSalaryAdvance>> =>
    unwrapListResponse(
      await api.get<ApiResponse<DriverSalaryAdvance[]>>("/driver-finance/salary-advances", {
        params: listParams(query),
      }),
    ),
  createSalaryAdvance: (body: CreateSalaryAdvanceBody) =>
    post<DriverSalaryAdvance>("/driver-finance/salary-advances", body),
  reverseSalaryAdvance: (id: string, reason: string) =>
    post<DriverSalaryAdvance>(`/driver-finance/salary-advances/${id}/reverse`, { reason }),

  payouts: async (query: DriverFinanceListQuery = {}): Promise<ListResult<DriverPayout>> =>
    unwrapListResponse(
      await api.get<ApiResponse<DriverPayout[]>>("/driver-finance/payouts", {
        params: listParams(query),
      }),
    ),
  createPayout: (body: CreatePayoutBody) => post<DriverPayout>("/driver-finance/payouts", body),
  reversePayout: (id: string, reason: string) =>
    post<DriverPayout>(`/driver-finance/payouts/${id}/reverse`, { reason }),

  salaryRuns: async (
    query: ListQuery & { status?: DriverSalaryRunStatus } = {},
  ): Promise<ListResult<DriverSalaryRunSummary>> =>
    unwrapListResponse(
      await api.get<ApiResponse<DriverSalaryRunSummary[]>>("/driver-finance/salary-runs", {
        params: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.search?.trim() ? { search: query.search.trim() } : {}),
          ...(query.page !== undefined ? { page: query.page } : {}),
          ...(query.size !== undefined ? { size: query.size } : {}),
        },
      }),
    ),
  salaryRun: async (id: string) =>
    unwrapApiResponse(
      await api.get<ApiResponse<DriverSalaryRun>>(`/driver-finance/salary-runs/${id}`),
    ),
  createSalaryRun: (body: { month: string }) =>
    post<DriverSalaryRun>("/driver-finance/salary-runs", body),
  updateSalaryRun: async (
    id: string,
    body: { version: number; lines: SalaryRunLineEdit[]; updateMaster?: boolean },
  ) =>
    unwrapApiResponse(
      await api.patch<ApiResponse<DriverSalaryRun>>(`/driver-finance/salary-runs/${id}`, body),
    ),
  approveSalaryRun: (id: string, version: number) =>
    post<DriverSalaryRun>(`/driver-finance/salary-runs/${id}/approve`, { version }),
  paySalaryRun: (
    id: string,
    body: {
      driverIds: string[];
      paidAt: string;
      referenceNo?: string;
      /** Accounts in order; amounts add up to the total due. */
      sources: { fundingLedgerId: string; mode: PaymentMode; amountPaise: string }[];
      clientRequestId: string;
    },
  ) => post<DriverSalaryRun>(`/driver-finance/salary-runs/${id}/pay`, body),

  /** Drivers who left with an unsettled account (G9). */
  leftWithBalance: async () =>
    unwrapApiResponse(
      await api.get<ApiResponse<LeftDriverBalance[]>>("/driver-finance/left-with-balance"),
    ),

  /** Cash / bank accounts with what each holds now. */
  fundingAccounts: async () =>
    unwrapApiResponse(
      await api.get<ApiResponse<FundingAccount[]>>("/driver-finance/funding-accounts"),
    ),
  cancelSalaryRun: (id: string, version: number, reason: string) =>
    post<DriverSalaryRun>(`/driver-finance/salary-runs/${id}/cancel`, { version, reason }),

  logSlipPayoutStatus: async (logSlipId: string) =>
    unwrapApiResponse(
      await api.get<ApiResponse<LogSlipPayoutStatus>>(
        `/driver-finance/log-slips/${logSlipId}/payout-status`,
      ),
    ),
};

export const driverFinanceKeys = {
  all: ["driver-finance"] as const,
  balance: (driverId: string) => ["driver-finance", "balance", driverId] as const,
  statement: (driverId: string, range: { from?: string; to?: string }) =>
    ["driver-finance", "statement", driverId, range] as const,
  salaryAdvances: (query: DriverFinanceListQuery) =>
    ["driver-finance", "salary-advances", query] as const,
  payouts: (query: DriverFinanceListQuery) => ["driver-finance", "payouts", query] as const,
  logSlipPayout: (logSlipId: string) =>
    ["driver-finance", "log-slip-payout", logSlipId] as const,
  salaryRuns: (search: string) => ["driver-finance", "salary-runs", search] as const,
  salaryRun: (id: string) => ["driver-finance", "salary-run", id] as const,
};
