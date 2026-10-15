const BPS_DENOMINATOR = 10_000n;

export function minimumOutput(quotedOutput: bigint, slippageBps = 100n): bigint {
  if (quotedOutput < 0n || slippageBps < 0n || slippageBps > BPS_DENOMINATOR) {
    throw new RangeError("Invalid output or slippage basis points");
  }
  return quotedOutput * (BPS_DENOMINATOR - slippageBps) / BPS_DENOMINATOR;
}

export function estimatePriceImpactBps(spotOutput: bigint | undefined, quotedOutput: bigint | undefined): bigint | undefined {
  if (spotOutput === undefined || quotedOutput === undefined || spotOutput <= 0n || quotedOutput < 0n) {
    return undefined;
  }
  return spotOutput > quotedOutput ? (spotOutput - quotedOutput) * BPS_DENOMINATOR / spotOutput : 0n;
}

export function formatImpactBps(impactBps: bigint | undefined): string {
  if (impactBps === undefined) return "—";
  const whole = impactBps / 100n;
  const fraction = (impactBps % 100n).toString().padStart(2, "0");
  return whole.toString() + "." + fraction + "%";
}
