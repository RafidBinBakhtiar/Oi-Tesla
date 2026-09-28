import { z } from 'zod';

/** Bangladeshi mobile number, local format: 01XXXXXXXXX (11 digits). */
export const PhoneNumber = z
  .string()
  .trim()
  .regex(/^01[3-9]\d{8}$/, 'Use an 11-digit Bangladeshi mobile number, e.g. 01711000001');

export const SignupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  phoneNumber: PhoneNumber,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
});

export const LoginSchema = z.object({
  phoneNumber: PhoneNumber,
  password: z.string().min(1).max(72),
});

export const DriverSignupSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(80),
  phoneNumber: PhoneNumber,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
  licenseNumber: z.string().trim().min(2, 'License number is required').max(40),
  vehicle: z.object({
    modelName: z.string().trim().min(2, 'Vehicle model is required').max(80),
    plateNumber: z.string().trim().min(2, 'Plate number is required').max(20),
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(8),
  }),
});
