import type { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        organizationId: string;
        roles: RoleName[];
      };
    }
  }
}

export {};