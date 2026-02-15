const UAH_LOCALE = 'uk-UA';
const UAH_CURRENCY = 'UAH';

export const formatPriceUAH = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '0 ₴';
  }

  return new Intl.NumberFormat(UAH_LOCALE, {
    style: 'currency',
    currency: UAH_CURRENCY,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(price);
};

export const formatPriceUAHCompact = (price: number): string => {
  if (typeof price !== 'number' || isNaN(price)) {
    return '0 ₴';
  }

  if (price >= 1_000_000) {
    return `${(price / 1_000_000).toFixed(1)} млн ₴`;
  }
  
  if (price >= 1_000) {
    return `${(price / 1_000).toFixed(0)} тис ₴`;
  }

  return formatPriceUAH(price);
};

export const formatPricePerSotkaUAH = (pricePerSotka: number): string => {
  return `${formatPriceUAH(pricePerSotka)}/сотка`;
};

export const formatPricePerHectareUAH = (pricePerSotka: number): string => {
  const pricePerHectare = pricePerSotka * 100;
  return `${formatPriceUAH(pricePerHectare)}/га`;
};

export const calculatePricePerHectare = (pricePerSotka: number): number => {
  if (typeof pricePerSotka !== 'number' || isNaN(pricePerSotka)) {
    return 0;
  }
  return pricePerSotka * 100;
};

export const calculateTotalPrice = (area: number, pricePerSotka: number): number => {
  if (typeof area !== 'number' || typeof pricePerSotka !== 'number') {
    return 0;
  }
  if (isNaN(area) || isNaN(pricePerSotka)) {
    return 0;
  }
  return area * pricePerSotka;
};

export const formatArea = (areaSotkas: number): string => {
  if (typeof areaSotkas !== 'number' || isNaN(areaSotkas)) {
    return '0 соток';
  }

  if (areaSotkas >= 100) {
    const hectares = areaSotkas / 100;
    return `${hectares.toFixed(2)} га`;
  }

  return `${areaSotkas} соток`;
};

export const formatAreaWithBoth = (areaSotkas: number): string => {
  if (typeof areaSotkas !== 'number' || isNaN(areaSotkas)) {
    return '0 соток';
  }

  if (areaSotkas >= 100) {
    const hectares = areaSotkas / 100;
    return `${hectares.toFixed(2)} га (${areaSotkas} соток)`;
  }

  return `${areaSotkas} соток`;
};

export const sotkasToHectares = (sotkas: number): number => {
  if (typeof sotkas !== 'number' || isNaN(sotkas)) {
    return 0;
  }
  return sotkas / 100;
};

export const hectaresToSotkas = (hectares: number): number => {
  if (typeof hectares !== 'number' || isNaN(hectares)) {
    return 0;
  }
  return hectares * 100;
};
