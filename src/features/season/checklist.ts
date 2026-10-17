/**
 * Pasos de fin de temporada. Los textos viven en i18n (checklist.<id>).
 * Los pasos tributarios enlazan a su regla en tax_rules (fuente y fecha de verificación).
 */
export interface ChecklistItem {
  id: string;
  /** Ruta interna o acción de la app */
  to?: '/paystubs' | 'export' | 'savings';
  /** Clave de tax_rules cuya fuente se muestra */
  ruleKey?: string;
}

export const CHECKLIST: ChecklistItem[] = [
  { id: 'last_paystub', to: '/paystubs' },
  { id: 'w2_address' },
  { id: 'fica_check', to: '/paystubs', ruleKey: 'fica_refund_procedure' },
  { id: 'form_8843', ruleKey: 'form_8843_filing' },
  { id: 'form_1040nr', ruleKey: 'form_1040nr_purpose' },
  { id: 'documents' },
  { id: 'bank' },
  { id: 'savings', to: 'savings' },
  { id: 'export', to: 'export' },
];
