import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";
import { config } from "../../config.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../middleware/errors.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";

const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  organizationId: true,
  organization: { select: { id: true, name: true, slug: true } },
  userRoles: { select: { role: { select: { name: true } } } },
} as const;

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  organization: { id: string; name: string; slug: string };
  userRoles: { role: { name: RoleName } }[];
};

function serializeUser(user: SafeUser) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    organizationId: user.organizationId,
    organization: user.organization,
    roles: user.userRoles.map(({ role }) => role.name),
  };
}

function issueToken(user: Pick<SafeUser, "id" | "organizationId">) {
  return jwt.sign(
    { sub: user.id, organizationId: user.organizationId },
    config.jwtSecret,
    { expiresIn: config.JWT_EXPIRES_IN } as jwt.SignOptions,
  );
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError("EMAIL_IN_USE", "An account with this email already exists.", 409);
  }

  const slugExists = await prisma.organization.findUnique({ where: { slug: input.organizationSlug } });
  if (slugExists) {
    throw new AppError("ORGANIZATION_SLUG_IN_USE", "That organization slug is already in use.", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: { name: input.organizationName, slug: input.organizationSlug },
    });
    const adminRole = await transaction.role.upsert({
      where: { name: RoleName.ADMIN },
      update: {},
      create: { name: RoleName.ADMIN, description: "Full access to organization settings and business data." },
    });
    return transaction.user.create({
      data: {
        organizationId: organization.id,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        userRoles: { create: { roleId: adminRole.id } },
      },
      select: userSelect,
    });
  });

  return { token: issueToken(user), user: serializeUser(user) };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...userSelect, passwordHash: true, isActive: true },
  });

  if (!user || !user.isActive || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError("INVALID_CREDENTIALS", "Email or password is incorrect.", 401);
  }

  return { token: issueToken(user), user: serializeUser(user) };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
  if (!user) {
    throw new AppError("USER_NOT_FOUND", "The current user no longer exists.", 404);
  }
  return serializeUser(user);
}