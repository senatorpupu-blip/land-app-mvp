export const CADASTRAL_NUMBER_REGEX = /^\d{10}:\d{2}:\d{3}:\d{4}$/;
export const CADASTRAL_NUMBER_REGEX_LOOSE = /^\d{10}:\d{2}:\d{3}:\d{1,4}$/;

export const validateCadastralFormat = (cadastralNumber: string): boolean => {
  return CADASTRAL_NUMBER_REGEX.test(cadastralNumber);
};

export const validateCadastralFormatLoose = (cadastralNumber: string): boolean => {
  return CADASTRAL_NUMBER_REGEX_LOOSE.test(cadastralNumber);
};

export const parseCadastralNumber = (cadastralNumber: string): {
  koatuuCode: string;
  oblastCode: string;
  raionCode: string;
  zoneCode: string;
  quarterCode: string;
  parcelCode: string;
} | null => {
  const match = cadastralNumber.match(/^(\d{10}):(\d{2}):(\d{3}):(\d{4})$/);
  
  if (!match) {
    return null;
  }
  
  const koatuuCode = match[1];
  
  return {
    koatuuCode,
    oblastCode: koatuuCode.slice(0, 2),
    raionCode: koatuuCode.slice(2, 4),
    zoneCode: match[2],
    quarterCode: match[3],
    parcelCode: match[4],
  };
};

export const getCadastralValidationStatus = (
  cadastralNumber: string,
  isVerified: boolean
): 'pending' | 'valid' | 'invalid' => {
  if (!validateCadastralFormat(cadastralNumber)) {
    return 'invalid';
  }
  
  if (isVerified) {
    return 'valid';
  }
  
  return 'pending';
};

export const extractOblastFromCadastral = (cadastralNumber: string): string | null => {
  const parsed = parseCadastralNumber(cadastralNumber);
  if (!parsed) {
    return null;
  }
  return parsed.oblastCode;
};
