import { z } from "zod";

export const text = (max = 200) => z.string().trim().min(1).max(max);
export const optionalText = (max = 2000) => z.string().trim().max(max);

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, "Invalid phone number");

export const email = z.string().trim().toLowerCase().email("Invalid email address").max(254);

export const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be an http(s) URL");

export const isoDate = z.coerce.date({ error: "Invalid date" });

export const stringList = (maxItems = 100) => z.array(text(120)).max(maxItems);

export const idParam = z.object({ id: z.string().min(1).max(64) });

export const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Every PATCH body must change at least one field.
export const nonEmpty = <T extends z.ZodObject>(schema: T) =>
  schema.refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");
