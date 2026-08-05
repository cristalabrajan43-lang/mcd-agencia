import { promises as fs } from 'fs';
import path from 'path';

// Lead interface for storing contact form submissions
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  message: string;
  product?: string;
  source?: string;
  createdAt: string;
}

const LEADS_DIR = path.join(process.cwd(), 'data', 'leads');
const LEADS_FILE = path.join(LEADS_DIR, 'leads.json');

// Asegurar que el directorio existe
async function ensureLeadsDirectory() {
  try {
    await fs.mkdir(LEADS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating leads directory:', error);
  }
}

// Guardar lead en archivo JSON
export async function saveLead(lead: Lead): Promise<void> {
  await ensureLeadsDirectory();

  try {
    // Leer leads existentes
    let leads: Lead[] = [];
    try {
      const data = await fs.readFile(LEADS_FILE, 'utf-8');
      leads = JSON.parse(data);
    } catch (error) {
      // Si el archivo no existe, empezar con array vacío
      leads = [];
    }

    // Agregar nuevo lead
    leads.push(lead);

    // Guardar de vuelta
    await fs.writeFile(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');

    // También guardar lead individual por ID para fácil acceso
    const leadFile = path.join(LEADS_DIR, `${lead.id}.json`);
    await fs.writeFile(leadFile, JSON.stringify(lead, null, 2), 'utf-8');

    console.log(`Lead ${lead.id} saved successfully`);
  } catch (error) {
    console.error('Error saving lead:', error);
    throw error;
  }
}

// Obtener todos los leads (útil para dashboard futuro)
export async function getAllLeads(): Promise<Lead[]> {
  try {
    const data = await fs.readFile(LEADS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return [];
  }
}

// Obtener lead por ID
export async function getLeadById(id: string): Promise<Lead | null> {
  try {
    const leadFile = path.join(LEADS_DIR, `${id}.json`);
    const data = await fs.readFile(leadFile, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}
