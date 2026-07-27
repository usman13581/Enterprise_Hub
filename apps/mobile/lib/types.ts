export type Supplier = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  trn: string | null;
  notes: string | null;
  active: boolean;
  _count?: { products: number };
};

export type ProductImage = {
  id: string;
  url: string;
  isDefault: boolean;
};

export type Product = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  purchasePrice: number;
  sellPrice: number;
  description: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  images: ProductImage[];
  active: boolean;
};

export type Customer = {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  trn: string | null;
  notes: string | null;
  active: boolean;
};

export type CompanyProfile = {
  id: string;
  legalName: string;
  tradeName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  trn: string | null;
  bankDetails: string | null;
  logoUrl: string | null;
  signatureUrl: string | null;
  quotationPrefix: string;
  invoicePrefix: string;
  currency: string;
};

export type Company = {
  id: string;
  name: string;
  slug: string;
  profile: CompanyProfile | null;
};
