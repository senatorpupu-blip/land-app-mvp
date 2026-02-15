// Cadastral number validation utilities for Ukrainian land registry
// Ukrainian cadastral number format: XXXXXXXXXX:XX:XXX:XXXX
// - First 10 digits: KOATUU code (region/district/settlement)
// - Next 2 digits: cadastral zone
// - Next 3 digits: cadastral quarter
// - Last 4 digits: parcel number

export const CADASTRAL_NUMBER_REGEX = /^\d{10}:\d{2}:\d{3}:\d{4}$/;
export const CADASTRAL_NUMBER_REGEX_LOOSE = /^\d{10}:\d{2}:\d{3}:\d{1,4}$/;

export const validateCadastralFormat = (cadastralNumber: string): boolean => {
  return CADASTRAL_NUMBER_REGEX.test(cadastralNumber);
};

export const validateCadastralFormatLoose = (cadastralNumber: string): boolean => {
  return CADASTRAL_NUMBER_REGEX_LOOSE.test(cadastralNumber);
};

export const formatCadastralNumber = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  
  if (digits.length <= 10) {
    return digits;
  } else if (digits.length <= 12) {
    return `${digits.slice(0, 10)}:${digits.slice(10)}`;
  } else if (digits.length <= 15) {
    return `${digits.slice(0, 10)}:${digits.slice(10, 12)}:${digits.slice(12)}`;
  } else {
    return `${digits.slice(0, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 15)}:${digits.slice(15, 19)}`;
  }
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

export const getPublicCadastralMapUrl = (cadastralNumber: string): string => {
  return `https://map.land.gov.ua/?cc=${encodeURIComponent(cadastralNumber)}`;
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

export interface CadastralApiResponse {
  isValid: boolean;
  exists: boolean;
  area?: number;
  purpose?: string;
  ownershipType?: string;
  errorMessage?: string;
}

// Mock verification - in production, this would call a real cadastral registry API
export const verifyCadastralNumber = async (cadastralNumber: string): Promise<{
  verified: boolean;
  message: string;
}> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  if (!validateCadastralFormat(cadastralNumber)) {
    return {
      verified: false,
      message: 'Invalid cadastral number format',
    };
  }
  
  // Mock verification - in production, call actual registry API
  const isValid = Math.random() > 0.2;
  
  return {
    verified: isValid,
    message: isValid 
      ? 'Cadastral number verified successfully' 
      : 'Cadastral number not found in registry',
  };
};

// Architecture for future cadastral API validation
export const validateCadastralWithApi = async (
  cadastralNumber: string
): Promise<CadastralApiResponse> => {
  if (!validateCadastralFormat(cadastralNumber)) {
    return {
      isValid: false,
      exists: false,
      errorMessage: 'Invalid cadastral number format',
    };
  }
  
  // TODO: Implement actual API call to Ukrainian cadastral registry
  // API endpoint: https://e.land.gov.ua/api/...
  // This is a placeholder for future implementation
  
  return {
    isValid: true,
    exists: true,
    errorMessage: undefined,
  };
};

export const CADASTRAL_HELP_TEXT = {
  en: 'Cadastral number format: XXXXXXXXXX:XX:XXX:XXXX (e.g., 3220810100:01:001:0001)',
  uk: 'Формат кадастрового номера: XXXXXXXXXX:XX:XXX:XXXX (напр., 3220810100:01:001:0001)',
};

export const extractOblastFromCadastral = (cadastralNumber: string): string | null => {
  const parsed = parseCadastralNumber(cadastralNumber);
  if (!parsed) {
    return null;
  }
  return parsed.oblastCode;
};
