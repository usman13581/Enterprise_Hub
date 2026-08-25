import { Injectable, NotFoundException } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';
import { UPLOADS_DIR } from '../uploads/uploads.constants';

export type ProductInput = {
  name: string;
  sku?: string | null;
  unit?: string;
  purchasePrice?: number;
  sellPrice?: number;
  description?: string | null;
  supplierId?: string | null;
  active?: boolean;
};

const withImages = {
  images: { orderBy: { createdAt: 'asc' } },
  supplier: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: withImages,
    });
  }

  async get(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: withImages,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async assertSupplier(companyId: string, supplierId?: string | null) {
    if (!supplierId) return null;
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier.id;
  }

  async create(session: SessionContext, input: ProductInput) {
    const supplierId = await this.assertSupplier(
      session.companyId,
      input.supplierId,
    );

    const product = await this.prisma.product.create({
      data: {
        companyId: session.companyId,
        supplierId,
        name: input.name,
        sku: input.sku ?? null,
        unit: input.unit?.trim() || 'sqm',
        purchasePrice: Number(input.purchasePrice ?? 0),
        sellPrice: Number(input.sellPrice ?? 0),
        description: input.description ?? null,
        active: input.active ?? true,
      },
      include: withImages,
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Product',
      entityId: product.id,
      action: 'create',
      after: product,
    });

    return product;
  }

  async update(session: SessionContext, id: string, input: ProductInput) {
    const before = await this.prisma.product.findFirst({
      where: { id, companyId: session.companyId },
      include: withImages,
    });
    if (!before) throw new NotFoundException('Product not found');

    const supplierId = await this.assertSupplier(
      session.companyId,
      input.supplierId,
    );

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        supplierId,
        name: input.name,
        sku: input.sku ?? null,
        unit: input.unit?.trim() || before.unit,
        purchasePrice: Number(input.purchasePrice ?? before.purchasePrice),
        sellPrice: Number(input.sellPrice ?? before.sellPrice),
        description: input.description ?? null,
        active: input.active ?? before.active,
      },
      include: withImages,
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Product',
      entityId: id,
      action: 'update',
      before,
      after: product,
    });

    return product;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.product.findFirst({
      where: { id, companyId: session.companyId },
      include: withImages,
    });
    if (!before) throw new NotFoundException('Product not found');

    const product = await this.prisma.product.update({
      where: { id },
      data: { active: false },
      include: withImages,
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Product',
      entityId: id,
      action: 'deactivate',
      before,
      after: product,
    });

    return { ok: true };
  }

  async addImage(session: SessionContext, productId: string, url: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId: session.companyId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const isFirst = product.images.length === 0;
    const image = await this.prisma.productImage.create({
      data: { productId, url, isDefault: isFirst },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'ProductImage',
      entityId: image.id,
      action: 'create',
      after: image,
    });

    return this.get(session.companyId, productId);
  }

  async setDefaultImage(
    session: SessionContext,
    productId: string,
    imageId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId: session.companyId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (!product.images.some((i) => i.id === imageId)) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isDefault: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isDefault: true },
      }),
    ]);

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'ProductImage',
      entityId: imageId,
      action: 'set-default',
      after: { productId, imageId },
    });

    return this.get(session.companyId, productId);
  }

  async removeImage(
    session: SessionContext,
    productId: string,
    imageId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId: session.companyId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const image = product.images.find((i) => i.id === imageId);
    if (!image) throw new NotFoundException('Image not found');

    const wasDefault = image.isDefault;
    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (wasDefault) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    await this.unlinkStaticFile(image.url);

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'ProductImage',
      entityId: imageId,
      action: 'delete',
      before: image,
    });

    return this.get(session.companyId, productId);
  }

  /** Best-effort remove of a local /static/... upload; ignore missing files. */
  private async unlinkStaticFile(url: string) {
    const match = /^\/static\/([^/]+)$/.exec(url.trim());
    if (!match) return;
    try {
      await unlink(join(UPLOADS_DIR, match[1]));
    } catch {
      // File may already be gone or stored elsewhere.
    }
  }
}
