import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidCacNumber, normalizeCacNumber } from "@/lib/kyc";
import { writeAuditLog } from "@/server/audit/write";
import { hashPassword } from "@/server/auth/crypto";
import { EmailSchema, PasswordSchema } from "@/server/auth/validation";

/**
 * Self-service hotel onboarding (multi-tenant).
 *
 * A business signs up once from the public site: this creates the tenant
 * organization, its first (draft) property, the OWNER account and the KYC
 * submission in a single transaction. The organization is ACTIVE immediately so
 * the owner can sign in at /staff/login and finish the property, while the KYC
 * evidence waits in the platform review queue.
 */

export const KYC_MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const KYC_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export const KYC_DOCUMENT_TYPES = [
  "CAC_CERTIFICATE",
  "BUSINESS_LICENSE",
  "TAX_CERTIFICATE",
  "OTHER",
] as const;

export type KycDocumentTypeValue = (typeof KYC_DOCUMENT_TYPES)[number];

const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "expected a lowercase slug like santo-hotel");

/**
 * Nigerian CAC registration numbers carry a class prefix and 5–10 digits:
 * RC 1234567 (company), BN 1234567 (business name), IT 12345 (trustees),
 * LP/LL for partnerships. A bare numeric number is accepted because older
 * certificates sometimes omit the prefix; arbitrary text is not.
 */
export { CAC_NUMBER_PATTERN, isValidCacNumber, normalizeCacNumber } from "@/lib/kyc";

export const HotelSignupSchema = z
  .object({
    organizationName: z.string().trim().min(2).max(120),
    organizationSlug: SlugSchema,
    hotelName: z.string().trim().min(2).max(120),
    hotelSlug: SlugSchema,
    ownerName: z.string().trim().min(2).max(80),
    email: EmailSchema,
    phone: z.string().trim().max(40).optional().nullable(),
    city: z.string().trim().max(100).optional().nullable(),
    country: z.string().trim().max(100).optional().nullable(),
    password: PasswordSchema,
    registrationNumber: z.string().trim().min(3).max(80),
    documentType: z.enum(KYC_DOCUMENT_TYPES),
  })
  .superRefine((value, ctx) => {
    if (value.documentType === "CAC_CERTIFICATE" && !isValidCacNumber(value.registrationNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["registrationNumber"],
        message:
          "Enter a valid CAC number, e.g. RC 1234567, BN 1234567 or IT 12345.",
      });
    }
  })
  .transform((value) => ({
    ...value,
    registrationNumber:
      value.documentType === "CAC_CERTIFICATE"
        ? normalizeCacNumber(value.registrationNumber)
        : value.registrationNumber.trim(),
  }));

export type HotelSignupFields = z.infer<typeof HotelSignupSchema>;

export type HotelSignupDocument = {
  name: string;
  mimeType: string;
  size: number;
  data: Uint8Array<ArrayBuffer>;
};

export type HotelSignupErrorCode =
  | "email_exists"
  | "organization_slug_taken"
  | "hotel_slug_taken";

export class HotelSignupError extends Error {
  constructor(
    readonly code: HotelSignupErrorCode,
    message = code,
  ) {
    super(message);
    this.name = "HotelSignupError";
  }
}

export async function createHotelSignup(
  input: HotelSignupFields,
  document: HotelSignupDocument,
) {
  const email = input.email.trim().toLowerCase();

  const [organizationClash, hotelClash, existingUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { slug: input.organizationSlug },
      select: { id: true },
    }),
    prisma.hotel.findUnique({ where: { slug: input.hotelSlug }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
  ]);

  if (existingUser) throw new HotelSignupError("email_exists");
  if (organizationClash) throw new HotelSignupError("organization_slug_taken");
  if (hotelClash) throw new HotelSignupError("hotel_slug_taken");

  const passwordHash = await hashPassword(input.password);

  const created = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug: input.organizationSlug,
        email,
        phone: input.phone || null,
        country: input.country || null,
        // The account is usable immediately; KYC is what gates marketplace
        // verification, not sign-in.
        status: "ACTIVE",
      },
    });

    const owner = await tx.user.create({
      data: {
        name: input.ownerName,
        email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
      },
    });

    const member = await tx.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: owner.id,
        role: "OWNER",
        status: "ACTIVE",
        activatedAt: new Date(),
      },
    });

    const hotel = await tx.hotel.create({
      data: {
        organizationId: organization.id,
        name: input.hotelName,
        slug: input.hotelSlug,
        email,
        phone: input.phone || null,
        city: input.city || null,
        country: input.country || null,
        timezone: "Africa/Lagos",
        currency: "NGN",
        publicationStatus: "DRAFT",
      },
    });

    const kyc = await tx.organizationKyc.create({
      data: {
        organizationId: organization.id,
        legalName: input.organizationName,
        registrationNumber: input.registrationNumber,
        documentType: input.documentType,
        documentName: document.name,
        documentMimeType: document.mimeType,
        documentSize: document.size,
        documentData: document.data,
        status: "PENDING",
      },
    });

    return { organization, owner, member, hotel, kyc };
  });

  await writeAuditLog({
    userId: created.owner.id,
    organizationId: created.organization.id,
    hotelId: created.hotel.id,
    action: "organization.self_signup",
    entityType: "organization",
    entityId: created.organization.id,
    newValues: {
      name: created.organization.name,
      slug: created.organization.slug,
      owner: created.owner.email,
      hotel: created.hotel.slug,
    },
  });
  await writeAuditLog({
    userId: created.owner.id,
    organizationId: created.organization.id,
    action: "organization.kyc_submit",
    entityType: "organization_kyc",
    entityId: created.kyc.id,
    newValues: {
      documentType: created.kyc.documentType,
      documentName: created.kyc.documentName,
      registrationNumber: created.kyc.registrationNumber,
    },
  });

  return {
    organizationId: created.organization.id,
    hotelId: created.hotel.id,
    ownerEmail: created.owner.email,
  };
}
