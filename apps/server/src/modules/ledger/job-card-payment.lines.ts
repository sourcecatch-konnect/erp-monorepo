import { BadRequestError } from "../../lib/error.js";

/** Service cost was accrued at bill posting; settlement has no expense line. */
export function buildJobCardPaymentLines(args: {
  providerLedgerId: string;
  fundingLedgerId: string;
  tdsLedgerId?: string;
  cashPaise: bigint;
  tdsPaise: bigint;
  narration: string;
}) {
  if (args.cashPaise <= 0n || args.tdsPaise < 0n)
    throw new BadRequestError("Invalid settlement amounts");
  const lines = [
    {
      ledgerId: args.providerLedgerId,
      debitPaise: args.cashPaise + args.tdsPaise,
      creditPaise: 0n,
      narration: args.narration,
    },
    {
      ledgerId: args.fundingLedgerId,
      debitPaise: 0n,
      creditPaise: args.cashPaise,
      narration: args.narration,
    },
  ];
  if (args.tdsPaise > 0n) {
    if (!args.tdsLedgerId)
      throw new BadRequestError("TDS payable ledger is required");
    lines.push({
      ledgerId: args.tdsLedgerId,
      debitPaise: 0n,
      creditPaise: args.tdsPaise,
      narration: args.narration,
    });
  }
  return lines;
}
