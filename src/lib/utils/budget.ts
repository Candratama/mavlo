export type SubsidyFlow = { in: number; out: number };

export function effectiveLimit(limitCents: number, flow: SubsidyFlow): number {
	return limitCents + flow.in - flow.out;
}

export function sourceRemaining(input: {
	limitCents: number;
	spentCents: number;
	subsidyOutCents: number;
}): number {
	return input.limitCents - input.spentCents - input.subsidyOutCents;
}
