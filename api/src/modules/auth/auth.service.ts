import { Prisma } from '@prisma/client';
import { AppError, conflict, notFound } from '../../lib/errors';
import { type AuthContext, signToken } from '../../lib/jwt';
import { hashPassword, verifyPassword } from '../../lib/password';
import { prisma } from '../../lib/prisma';

// Compared against when the phone number is unknown, so a miss costs the same
// time as a wrong password and phone numbers cannot be enumerated by timing.
const dummyHash = hashPassword('timing-equaliser-not-a-real-password');

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Invalid phone number or password');

export async function signupPassenger(input: { name: string; phoneNumber: string; password: string }) {
  const passwordHash = await hashPassword(input.password);
  try {
    const passenger = await prisma.passenger.create({
      data: { name: input.name, phoneNumber: input.phoneNumber, passwordHash },
    });
    return issue({ id: passenger.id, role: 'passenger' });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw conflict('That phone number is already registered', 'PHONE_TAKEN');
    }
    throw err;
  }
}

export async function loginPassenger(phoneNumber: string, password: string) {
  const passenger = await prisma.passenger.findUnique({ where: { phoneNumber } });
  const ok = await verifyPassword(password, passenger?.passwordHash ?? (await dummyHash));
  if (!passenger || !ok) throw invalidCredentials();
  return issue({ id: passenger.id, role: 'passenger' });
}

export async function loginDriver(phoneNumber: string, password: string) {
  const driver = await prisma.driver.findUnique({ where: { phoneNumber } });
  const ok = await verifyPassword(password, driver?.passwordHash ?? (await dummyHash));
  if (!driver || !ok) throw invalidCredentials();
  return issue({ id: driver.id, role: 'driver' });
}

async function issue(ctx: AuthContext) {
  return { token: signToken(ctx), user: await getProfile(ctx) };
}

export async function getProfile(ctx: AuthContext) {
  if (ctx.role === 'passenger') {
    const p = await prisma.passenger.findUnique({ where: { id: ctx.id } });
    if (!p) throw notFound('Account no longer exists');
    return {
      id: p.id,
      role: 'passenger' as const,
      name: p.name,
      phoneNumber: p.phoneNumber,
      walletBalancePaisa: p.walletBalancePaisa,
    };
  }

  const d = await prisma.driver.findUnique({
    where: { id: ctx.id },
    include: { vehicle: true, currentSubLocation: true },
  });
  if (!d) throw notFound('Account no longer exists');
  return {
    id: d.id,
    role: 'driver' as const,
    name: d.name,
    phoneNumber: d.phoneNumber,
    licenseNumber: d.licenseNumber,
    isOnline: d.isOnline,
    currentSubLocation: d.currentSubLocation
      ? { id: d.currentSubLocation.id, name: d.currentSubLocation.name }
      : null,
    vehicle: d.vehicle
      ? {
          id: d.vehicle.id,
          modelName: d.vehicle.modelName,
          plateNumber: d.vehicle.plateNumber,
          capacity: d.vehicle.capacity,
        }
      : null,
  };
}
