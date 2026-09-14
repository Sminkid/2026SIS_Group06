type CurrencyCode = "AUD";

interface FeeRate {
  studentType: string;
  currency: CurrencyCode;
  costPerSixCreditPointsCents: number;
}

export interface EstimatedCourseFee {
  studentType: string;
  currency: CurrencyCode;
  estimatedTotalCostCents: number;
}

const universityFeeRates: Record<string, Record<number, FeeRate[]>> = {
  UTS: {
    2026: [
      { studentType: "Domestic (CSP)", currency: "AUD", costPerSixCreditPointsCents: 119_200 },
      { studentType: "International", currency: "AUD", costPerSixCreditPointsCents: 684_600 },
    ],
  },
};

export const estimateCourseFees = (
  universityCode: string,
  handbookYear: number,
  degreeName: string,
  creditPoints: number | null,
): EstimatedCourseFee[] => {
  if (universityCode !== "UTS" || !/\bengineering\b/i.test(degreeName)) return [];

  const rates = universityFeeRates[universityCode]?.[handbookYear];
  if (!rates || creditPoints === null || creditPoints <= 0) return [];

  const sixCreditPointBlocks = creditPoints / 6;
  return rates.map((rate) => ({
    studentType: rate.studentType,
    currency: rate.currency,
    estimatedTotalCostCents: sixCreditPointBlocks * rate.costPerSixCreditPointsCents,
  }));
};

export const formatCourseFee = (fee: EstimatedCourseFee): string =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: fee.currency,
    maximumFractionDigits: 0,
  }).format(fee.estimatedTotalCostCents / 100);
