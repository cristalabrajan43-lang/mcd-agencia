import { z } from 'zod';
import { SERVICE_IDS } from './service-ids';

// Schema de validación para el formulario de cotización
export const quoteFormSchema = z.object({
  // Datos de contacto (obligatorios)
  nombre: z.string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo'),

  empresa: z.string().optional(),

  email: z.string()
    .email('Email inválido')
    .min(5, 'El email es demasiado corto')
    .max(100, 'El email es demasiado largo'),

  telefono: z.string()
    .regex(/^\+?[0-9]{10,15}$/, 'Formato de teléfono inválido'),

  // Fecha requerida (obligatorio)
  fechaRequerida: z.string().min(1, 'La fecha es requerida'),

  // Servicio (obligatorio) - Usa los IDs de service-ids.ts
  servicio: z.enum(SERVICE_IDS, {
    errorMap: () => ({ message: 'Selecciona un servicio' }),
  }),

  // Consentimiento de privacidad (obligatorio)
  privacidad: z.boolean()
    .refine((val) => val === true, {
      message: 'Debes aceptar el aviso de privacidad',
    }),

  // Comentarios opcionales
  comentarios: z.string()
    .max(2000, 'Los comentarios son demasiado largos')
    .optional(),

  // Honeypot para anti-spam (debe estar vacío)
  website: z.string().max(0).optional(),
});

export type QuoteFormData = z.infer<typeof quoteFormSchema>;

// Schema para el payload que se envía al API
export const leadPayloadSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  contacto: z.object({
    nombre: z.string(),
    empresa: z.string().nullable(),
    telefono: z.string(),
    email: z.string().email(),
  }),
  fecha_requerida: z.string(),
  servicio: z.string(),
  detalles: z.record(z.unknown()),
  archivos: z.array(z.object({
    nombre: z.string(),
    tamano: z.number(),
  })),
  comentarios: z.string().nullable(),
  metadata: z.object({
    utm_source: z.string().nullable(),
    utm_medium: z.string().nullable(),
    utm_campaign: z.string().nullable(),
    referrer: z.string().nullable(),
    user_agent: z.string(),
    page_url: z.string(),
  }),
  recaptcha_token: z.string().nullable(),
});

export type LeadPayload = z.infer<typeof leadPayloadSchema>;
