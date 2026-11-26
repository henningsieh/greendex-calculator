import { z } from "zod";

function validIbanChecksum(iban: string) {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const character of rearranged) {
    const digits = /[A-Z]/.test(character)
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/**
 * Client-side mirror of the Payout Account procedure contract. The server
 * remains authoritative; this schema only blocks malformed input before the
 * round trip and binds each message to its field.
 */
export const PayoutAccountCreateSchema = z.object({
  accountHolder: z
    .string()
    .trim()
    .min(1, "accountHolderRequired")
    .max(200, "accountHolderTooLong"),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(15, "ibanInvalid")
        .max(34, "ibanInvalid")
        .regex(/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/, "ibanInvalid")
        .refine(validIbanChecksum, "ibanInvalid"),
    ),
  bic: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .refine(
      (value) =>
        value === "" ||
        /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(value),
      "bicInvalid",
    ),
});

export type PayoutAccountCreateValues = z.infer<typeof PayoutAccountCreateSchema>;
