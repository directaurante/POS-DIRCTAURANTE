/**
 * DIRECTAURANTE POS CORE — DirectImport Service
 * Preview and import menus from legacy POS (SoftRestaurant, Toast, Micros, Excel).
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { ImportJob, Product } from '../../core/types';
import { AuditService } from '../../core/audit';

export interface ImportCandidate {
  raw_name: string;
  mapped_name: string;
  price_cents: number;
  category: string;
  destination_station: 'kitchen' | 'bar';
  has_issue?: boolean;
  issue_description?: string;
}

export class ImportService {
  private static jobs: ImportJob[] = [];
  private static candidatesMap: Map<string, ImportCandidate[]> = new Map();

  public static createPreview(
    source_pos: string,
    file_name: string,
    rows: Array<{ name: string; price?: number; precio?: number; category?: string; categoria?: string; destination_station?: string }>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): { job: ImportJob; candidates: ImportCandidate[] } & ImportJob & { candidates: ImportCandidate[] } {
    const existingProducts = db.get('products').filter((p) => p.restaurant_id === restaurant_id);

    const candidates: ImportCandidate[] = rows.map((r) => {
      const name = r.name.trim();
      const rawPrice = r.precio !== undefined ? r.precio : (r.price !== undefined ? r.price : 0);
      const category = (r.categoria || r.category || 'General').trim();
      const station = (r.destination_station === 'bar' || category.toLowerCase().includes('bebida')) ? 'bar' : 'kitchen';

      const isDuplicate = existingProducts.some(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );

      return {
        raw_name: name,
        mapped_name: name,
        price_cents: Math.round(rawPrice * 100),
        category,
        destination_station: station,
        has_issue: isDuplicate,
        issue_description: isDuplicate ? `Producto ya existente en el catálogo (${name})` : undefined,
      };
    });

    const categories = Array.from(new Set(candidates.map((c) => c.category)));
    const sample = candidates.slice(0, 5).map((c) => ({
      name: c.mapped_name,
      price: c.price_cents / 100,
      category: c.category,
    }));

    const job: ImportJob = {
      id: `imp_${Date.now()}`,
      restaurant_id,
      source_pos,
      file_name,
      status: 'preview_ready',
      total_products_detected: candidates.length,
      issues_count: candidates.filter((c) => c.has_issue).length,
      created_at: new Date().toISOString(),
      preview_data: {
        categories,
        sample_products: sample,
      },
    };

    this.jobs.unshift(job);
    this.candidatesMap.set(job.id, candidates);

    return Object.assign(job, { job, candidates });
  }

  public static executeImport(
    job_id: string,
    products: Array<{ name: string; price: number; category: string; destination_station?: 'kitchen' | 'bar' }>,
    actor: string = 'Admin',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const job = this.jobs.find((j) => j.id === job_id);
    if (!job) {
      throw new Error(`Job de importación ${job_id} no encontrado.`);
    }

    const created: Product[] = [];
    for (const p of products) {
      const prod: Product = {
        id: `prod_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        restaurant_id,
        name: p.name,
        category: (p.category as any) || 'Platillos',
        description: `Importado desde ${job.source_pos}`,
        price_cents: Math.round(p.price * 100),
        ingredient_ids: [],
        destination_station: p.destination_station || 'kitchen',
        preparation_time_minutes: 10,
        available: true,
      };
      db.get('products').push(prod);
      created.push(prod);
    }

    job.status = 'imported';
    db.save();

    AuditService.log(
      'menu_imported',
      'plugin',
      job_id,
      actor,
      null,
      { count: created.length, source: job.source_pos },
      `${created.length} productos importados exitosamente desde ${job.source_pos}.`,
      restaurant_id
    );

    return { success: true, imported_count: created.length };
  }
}
