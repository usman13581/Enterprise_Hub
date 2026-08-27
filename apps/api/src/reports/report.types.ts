export type ReportColumnDto = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  money?: boolean;
};

export type ReportStatDto = {
  label: string;
  value: string | number;
  money?: boolean;
};

export type ReportResult = {
  key: string;
  title: string;
  params: Record<string, string | null>;
  summary: ReportStatDto[];
  columns: ReportColumnDto[];
  rows: Array<Record<string, string | number | null>>;
  footerNote?: string | null;
};

export type ReportQuery = {
  from?: string;
  to?: string;
  asOf?: string;
  customerId?: string;
  jobId?: string;
  kind?: string;
  status?: string;
};
