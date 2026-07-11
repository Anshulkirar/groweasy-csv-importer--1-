/**
 * GrowEasy CRM domain types.
 * Kept in a single file so the allowed-value lists have one source of truth
 * that both the AI prompt builder and the response validator import from.
 */

export const CRM_STATUS_VALUES = [
  "GOOD_LEAD_FOLLOW_UP",
  "DID_NOT_CONNECT",
  "BAD_LEAD",
  "SALE_DONE",
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  "leads_on_demand",
  "meridian_tower",
  "eden_park",
  "varah_swamy",
  "sarjapur_plots",
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

/** A single GrowEasy CRM lead record, exactly as returned to the client. */
export interface CrmRecord {
  created_at: string;
  name: string;
  email: string;
  country_code: string;
  mobile_without_country_code: string;
  company: string;
  city: string;
  state: string;
  country: string;
  lead_owner: string;
  crm_status: CrmStatus | "";
  crm_note: string;
  data_source: DataSource | "";
  possession_time: string;
  description: string;
}

/** A raw row parsed from the uploaded CSV, before AI mapping. Keys are whatever the source file used. */
export type RawCsvRow = Record<string, string>;

export interface SkippedRecord {
  /** Index of the row in the original uploaded file (0-based, excluding header). */
  rowIndex: number;
  /** The raw row that could not be mapped, for user inspection. */
  raw: RawCsvRow;
  reason: string;
}

export interface ImportResult {
  records: CrmRecord[];
  skipped: SkippedRecord[];
  totalImported: number;
  totalSkipped: number;
  totalRows: number;
}

export const EMPTY_CRM_RECORD: CrmRecord = {
  created_at: "",
  name: "",
  email: "",
  country_code: "",
  mobile_without_country_code: "",
  company: "",
  city: "",
  state: "",
  country: "",
  lead_owner: "",
  crm_status: "",
  crm_note: "",
  data_source: "",
  possession_time: "",
  description: "",
};
