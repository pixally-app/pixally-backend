import { BadRequestException } from '@nestjs/common';

function validateBrazilianPhone(phoneNumber: string) {
  // Mobile: area code (2 digits) + 9 digits = 11 digits
  // Landline: area code (2 digits) + 8 digits = 10 digits
  if (!/^\d{10,11}$/.test(phoneNumber)) {
    throw new BadRequestException(
      `Invalid Brazilian phone number: ${phoneNumber}. Expected 10 digits (landline) or 11 digits (mobile)`,
    );
  }

  if (phoneNumber.length === 11 && phoneNumber[2] !== '9') {
    throw new BadRequestException(
      `Invalid Brazilian mobile number: ${phoneNumber}. Mobile numbers must start with 9 after the area code`,
    );
  }
}

export function validatePhones(phones: { dialCode: string; phoneNumber: string }[]) {
  for (const phone of phones) {
    if (phone.dialCode === '+55') {
      validateBrazilianPhone(phone.phoneNumber);
    }
  }
}
