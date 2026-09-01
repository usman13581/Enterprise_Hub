import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext, isCompanySession } from '../auth/session.types';

const employeeSelect = {
  id: true,
  companyId: true,
  userId: true,
  employeeNumber: true,
  firstName: true,
  lastName: true,
  preferredName: true,
  email: true,
  phone: true,
  photoUrl: true,
  nationality: true,
  emergencyContact: true,
  emergencyPhone: true,
  emiratesIdNumber: true,
  emiratesIdIssueDate: true,
  emiratesIdExpiry: true,
  passportNumber: true,
  passportCountry: true,
  passportIssueDate: true,
  passportExpiry: true,
  visaExpiry: true,
  workPermitExpiry: true,
  employmentType: true,
  status: true,
  departmentId: true,
  designationId: true,
  managerId: true,
  joiningDate: true,
  probationEndDate: true,
  terminationDate: true,
  bankName: true,
  bankAccountLast4: true,
  ibanLast4: true,
  notes: true,
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
} as const;

function date(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid date: ${value}`);
  }
  return parsed;
}

function requiredDate(value: string | undefined, label: string) {
  const parsed = date(value);
  if (!parsed) throw new BadRequestException(`${label} is required`);
  return parsed;
}

function isAdmin(session: SessionContext) {
  return isCompanySession(session) && session.companyRole === 'admin' && !session.readOnly;
}

function employeeScope(session: SessionContext) {
  return isCompanySession(session) && session.companyRole === 'member' && !session.readOnly
    ? { userId: session.userId }
    : {};
}

function redactEmployee<T extends Record<string, unknown>>(employee: T, allowSensitive: boolean) {
  if (allowSensitive) return employee;
  return {
    ...employee,
    emiratesIdNumber: null,
    emiratesIdIssueDate: null,
    emiratesIdExpiry: null,
    passportNumber: null,
    passportIssueDate: null,
    passportExpiry: null,
    visaExpiry: null,
    workPermitExpiry: null,
    bankName: null,
    bankAccountLast4: null,
    ibanLast4: null,
    emergencyContact: null,
    emergencyPhone: null,
    ...(Array.isArray(employee.documents)
      ? { documents: employee.documents.map((document) => ({ ...document, fileUrl: null })) }
      : {}),
  };
}

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireAdmin(session: SessionContext) {
    if (!isAdmin(session)) throw new ForbiddenException('Company admin access required.');
  }

  private async employeeForSession(session: SessionContext) {
    if (!isCompanySession(session)) {
      throw new ForbiddenException('Company employee session required.');
    }
    const employee = await this.prisma.hREmployee.findFirst({
      where: { companyId: session.companyId, userId: session.userId },
      select: employeeSelect,
    });
    if (!employee) {
      throw new NotFoundException(
        'Your account is not linked to an active HR employee record.',
      );
    }
    if (employee.status !== 'active') {
      throw new ForbiddenException('This employee record is not active.');
    }
    return employee;
  }

  async dashboard(session: SessionContext) {
    if (!isCompanySession(session)) {
      throw new ForbiddenException('Company session required.');
    }
    const companyId = session.companyId;
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const [employees, activeEmployees, openAttendance, pendingLeave, pendingOvertime, expiringDocuments] =
      await Promise.all([
        this.prisma.hREmployee.count({ where: { companyId } }),
        this.prisma.hREmployee.count({ where: { companyId, status: 'active' } }),
        this.prisma.hRAttendance.count({ where: { companyId, checkOutAt: null } }),
        this.prisma.hRLeaveRequest.count({ where: { companyId, status: 'pending' } }),
        this.prisma.hROvertimeRequest.count({ where: { companyId, status: 'pending' } }),
        this.prisma.hREmployeeDocument.count({
          where: { companyId, expiryDate: { lte: in30 }, status: 'current' },
        }),
      ]);
    return {
      employees,
      activeEmployees,
      openAttendance,
      pendingLeave,
      pendingOvertime,
      expiringDocuments,
      canManage: isAdmin(session),
    };
  }

  async listEmployees(session: SessionContext, status?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const rows = await this.prisma.hREmployee.findMany({
      where: {
        companyId: session.companyId,
        ...(status ? { status } : {}),
        ...employeeScope(session),
      },
      orderBy: [{ status: 'asc' }, { firstName: 'asc' }],
      select: employeeSelect,
    });
    return rows.map((row) => redactEmployee(row, isAdmin(session)));
  }

  async getEmployee(session: SessionContext, id: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = await this.prisma.hREmployee.findFirst({
      where: { id, companyId: session.companyId, ...employeeScope(session) },
      select: {
        ...employeeSelect,
        documents: { orderBy: { expiryDate: 'asc' } },
        salaryProfiles: isAdmin(session)
          ? { orderBy: { effectiveFrom: 'desc' }, take: 10 }
          : false,
        benefits: { include: { benefit: true } },
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return redactEmployee(employee, isAdmin(session) || employee.userId === session.userId);
  }

  async createEmployee(
    session: SessionContext,
    input: {
      firstName: string;
      lastName?: string | null;
      preferredName?: string | null;
      email?: string | null;
      phone?: string | null;
      nationality?: string | null;
      employmentType?: string;
      joiningDate: string;
      userId?: string | null;
      departmentId?: string | null;
      designationId?: string | null;
      managerId?: string | null;
      status?: string;
      notes?: string | null;
      bankName?: string | null;
      bankAccountLast4?: string | null;
      ibanLast4?: string | null;
      emiratesIdNumber?: string | null;
      emiratesIdExpiry?: string | null;
      passportNumber?: string | null;
      passportCountry?: string | null;
      passportExpiry?: string | null;
      visaExpiry?: string | null;
      workPermitExpiry?: string | null;
    },
  ) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.firstName?.trim()) {
      throw new BadRequestException('firstName is required');
    }
    const companyId = session.companyId;
    if (input.userId) {
      const user = await this.prisma.user.findFirst({
        where: { id: input.userId, companyId },
        select: { id: true },
      });
      if (!user) throw new BadRequestException('User does not belong to this company');
      const linked = await this.prisma.hREmployee.findUnique({ where: { userId: input.userId } });
      if (linked) throw new ConflictException('This user is already linked to an employee');
    }
    const next = await this.prisma.hREmployee.count({ where: { companyId } });
    const employee = await this.prisma.hREmployee.create({
      data: {
        companyId,
        userId: input.userId ?? null,
        employeeNumber: `EMP-${String(next + 1).padStart(4, '0')}`,
        firstName: input.firstName.trim(),
        lastName: input.lastName?.trim() || null,
        preferredName: input.preferredName?.trim() || null,
        email: input.email?.trim().toLowerCase() || null,
        phone: input.phone?.trim() || null,
        nationality: input.nationality?.trim() || null,
        employmentType: input.employmentType || 'full_time',
        joiningDate: requiredDate(input.joiningDate, 'joiningDate'),
        status: input.status || 'active',
        departmentId: input.departmentId || null,
        designationId: input.designationId || null,
        managerId: input.managerId || null,
        notes: input.notes?.trim() || null,
        bankName: input.bankName?.trim() || null,
        bankAccountLast4: input.bankAccountLast4?.replace(/\D/g, '').slice(-4) || null,
        ibanLast4: input.ibanLast4?.replace(/\D/g, '').slice(-4) || null,
        emiratesIdNumber: input.emiratesIdNumber?.trim() || null,
        emiratesIdExpiry: date(input.emiratesIdExpiry),
        passportNumber: input.passportNumber?.trim() || null,
        passportCountry: input.passportCountry?.trim() || null,
        passportExpiry: date(input.passportExpiry),
        visaExpiry: date(input.visaExpiry),
        workPermitExpiry: date(input.workPermitExpiry),
      },
      select: employeeSelect,
    });
    await this.audit.write({
      companyId,
      actorId: session.userId,
      entityType: 'HREmployee',
      entityId: employee.id,
      action: 'create',
      after: employee,
    });
    return employee;
  }

  async updateEmployee(session: SessionContext, id: string, input: Record<string, unknown>) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const before = await this.prisma.hREmployee.findFirst({ where: { id, companyId: session.companyId } });
    if (!before) throw new NotFoundException('Employee not found');
    const text = (key: string) =>
      typeof input[key] === 'string' ? String(input[key]).trim() || null : undefined;
    const employee = await this.prisma.hREmployee.update({
      where: { id },
      data: {
        ...(text('firstName') ? { firstName: text('firstName')! } : {}),
        ...(text('lastName') !== undefined ? { lastName: text('lastName') } : {}),
        ...(text('preferredName') !== undefined ? { preferredName: text('preferredName') } : {}),
        ...(text('email') !== undefined ? { email: text('email')?.toLowerCase() ?? null } : {}),
        ...(text('phone') !== undefined ? { phone: text('phone') } : {}),
        ...(text('nationality') !== undefined ? { nationality: text('nationality') } : {}),
        ...(typeof input.status === 'string' ? { status: input.status } : {}),
        ...(typeof input.departmentId === 'string' || input.departmentId === null
          ? { departmentId: input.departmentId as string | null } : {}),
        ...(typeof input.designationId === 'string' || input.designationId === null
          ? { designationId: input.designationId as string | null } : {}),
        ...(typeof input.notes === 'string' ? { notes: text('notes') } : {}),
        ...(typeof input.employmentType === 'string' ? { employmentType: input.employmentType } : {}),
        ...(typeof input.joiningDate === 'string'
          ? { joiningDate: requiredDate(input.joiningDate, 'joiningDate') } : {}),
        ...(text('emiratesIdNumber') !== undefined ? { emiratesIdNumber: text('emiratesIdNumber') } : {}),
        ...(typeof input.emiratesIdExpiry === 'string' || input.emiratesIdExpiry === null
          ? { emiratesIdExpiry: date(input.emiratesIdExpiry as string | null) } : {}),
        ...(text('passportNumber') !== undefined ? { passportNumber: text('passportNumber') } : {}),
        ...(text('passportCountry') !== undefined ? { passportCountry: text('passportCountry') } : {}),
        ...(typeof input.passportExpiry === 'string' || input.passportExpiry === null
          ? { passportExpiry: date(input.passportExpiry as string | null) } : {}),
        ...(typeof input.visaExpiry === 'string' || input.visaExpiry === null
          ? { visaExpiry: date(input.visaExpiry as string | null) } : {}),
        ...(typeof input.workPermitExpiry === 'string' || input.workPermitExpiry === null
          ? { workPermitExpiry: date(input.workPermitExpiry as string | null) } : {}),
      },
      select: employeeSelect,
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'HREmployee',
      entityId: id,
      action: 'update',
      before,
      after: employee,
    });
    return employee;
  }

  async deleteEmployee(session: SessionContext, id: string) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const before = await this.prisma.hREmployee.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Employee not found');
    await this.prisma.hREmployee.updateMany({
      where: { companyId: session.companyId, managerId: id },
      data: { managerId: null },
    });
    await this.prisma.hREmployee.delete({ where: { id } });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'HREmployee',
      entityId: id,
      action: 'delete',
      before,
    });
    return { ok: true };
  }

  async listOrganization(session: SessionContext, includeInactive = false) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const activeFilter = includeInactive ? {} : { active: true };
    const [departments, designations, locations, holidays, policy] = await Promise.all([
      this.prisma.hRDepartment.findMany({ where: { companyId: session.companyId, ...activeFilter }, orderBy: { name: 'asc' } }),
      this.prisma.hRDesignation.findMany({ where: { companyId: session.companyId, ...activeFilter }, orderBy: { name: 'asc' } }),
      this.prisma.hRWorkLocation.findMany({ where: { companyId: session.companyId, ...activeFilter }, orderBy: { name: 'asc' } }),
      this.prisma.hRHoliday.findMany({ where: { companyId: session.companyId }, orderBy: { date: 'asc' } }),
      this.prisma.hRPolicyProfile.findUnique({ where: { companyId: session.companyId } }),
    ]);
    return { departments, designations, locations, holidays, policy };
  }

  async updateOrganization(
    session: SessionContext,
    id: string,
    input: {
      kind: 'department' | 'designation' | 'location' | 'holiday';
      name?: string | null;
      active?: boolean;
      date?: string | null;
      address?: string | null;
      locationKind?: string | null;
    },
  ) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const companyId = session.companyId;
    if (input.kind === 'department') {
      const before = await this.prisma.hRDepartment.findFirst({ where: { id, companyId } });
      if (!before) throw new NotFoundException('Department not found');
      const row = await this.prisma.hRDepartment.update({
        where: { id },
        data: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
        },
      });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'HRDepartment', entityId: id, action: 'update', before, after: row });
      return row;
    }
    if (input.kind === 'designation') {
      const before = await this.prisma.hRDesignation.findFirst({ where: { id, companyId } });
      if (!before) throw new NotFoundException('Designation not found');
      const row = await this.prisma.hRDesignation.update({
        where: { id },
        data: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
        },
      });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'HRDesignation', entityId: id, action: 'update', before, after: row });
      return row;
    }
    if (input.kind === 'location') {
      const before = await this.prisma.hRWorkLocation.findFirst({ where: { id, companyId } });
      if (!before) throw new NotFoundException('Work location not found');
      const row = await this.prisma.hRWorkLocation.update({
        where: { id },
        data: {
          ...(input.name?.trim() ? { name: input.name.trim() } : {}),
          ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
          ...(input.locationKind?.trim() ? { kind: input.locationKind.trim() } : {}),
          ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
        },
      });
      await this.audit.write({ companyId, actorId: session.userId, entityType: 'HRWorkLocation', entityId: id, action: 'update', before, after: row });
      return row;
    }
    const before = await this.prisma.hRHoliday.findFirst({ where: { id, companyId } });
    if (!before) throw new NotFoundException('Holiday not found');
    const row = await this.prisma.hRHoliday.update({
      where: { id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.date ? { date: requiredDate(input.date, 'date') } : {}),
      },
    });
    await this.audit.write({ companyId, actorId: session.userId, entityType: 'HRHoliday', entityId: id, action: 'update', before, after: row });
    return row;
  }

  async createOrganization(
    session: SessionContext,
    input: { kind: 'department' | 'designation' | 'location' | 'holiday'; name?: string; date?: string; address?: string; locationKind?: string },
  ) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const companyId = session.companyId;
    if (!input.name?.trim()) throw new BadRequestException('name is required');
    if (input.kind === 'department') return this.prisma.hRDepartment.create({ data: { companyId, name: input.name.trim() } });
    if (input.kind === 'designation') return this.prisma.hRDesignation.create({ data: { companyId, name: input.name.trim() } });
    if (input.kind === 'location') return this.prisma.hRWorkLocation.create({ data: { companyId, name: input.name.trim(), address: input.address?.trim() || null, kind: input.locationKind || 'office' } });
    return this.prisma.hRHoliday.create({ data: { companyId, name: input.name.trim(), date: requiredDate(input.date, 'date') } });
  }

  async listDocuments(session: SessionContext, employeeId?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = employeeId
      ? await this.prisma.hREmployee.findFirst({ where: { id: employeeId, companyId: session.companyId, ...employeeScope(session) }, select: { id: true } })
      : await this.employeeForSession(session);
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.hREmployeeDocument.findMany({
      where: { companyId: session.companyId, employeeId: employee.id },
      orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createDocument(session: SessionContext, employeeId: string, input: Record<string, unknown>) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: employeeId, companyId: session.companyId }, select: { id: true } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (typeof input.documentType !== 'string' || !input.documentType.trim()) throw new BadRequestException('documentType is required');
    const document = await this.prisma.hREmployeeDocument.create({
      data: {
        companyId: session.companyId,
        employeeId,
        documentType: input.documentType.trim(),
        documentNumber: typeof input.documentNumber === 'string' ? input.documentNumber.trim() || null : null,
        issueDate: typeof input.issueDate === 'string' ? date(input.issueDate) : null,
        expiryDate: typeof input.expiryDate === 'string' ? date(input.expiryDate) : null,
        issuingCountry: typeof input.issuingCountry === 'string' ? input.issuingCountry.trim() || null : null,
        issuingAuthority: typeof input.issuingAuthority === 'string' ? input.issuingAuthority.trim() || null : null,
        fileUrl: typeof input.fileUrl === 'string' ? input.fileUrl.trim() || null : null,
        notes: typeof input.notes === 'string' ? input.notes.trim() || null : null,
      },
    });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HREmployeeDocument', entityId: document.id, action: 'create', after: document });
    return document;
  }

  async expiringDocuments(session: SessionContext, days = 30) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const until = new Date(Date.now() + Math.max(1, Math.min(days, 365)) * 86_400_000);
    return this.prisma.hREmployeeDocument.findMany({
      where: { companyId: session.companyId, status: 'current', expiryDate: { lte: until }, ...(session.companyRole === 'member' && !session.readOnly ? { employee: { userId: session.userId } } : {}) },
      orderBy: { expiryDate: 'asc' },
      include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } },
    });
  }

  async getDocument(session: SessionContext, id: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const document = await this.prisma.hREmployeeDocument.findFirst({
      where: { id, companyId: session.companyId, ...(isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } }) },
      select: { id: true, documentType: true, expiryDate: true, fileUrl: true, employeeId: true },
    });
    if (!document) throw new NotFoundException('Document not found');
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HREmployeeDocument', entityId: id, action: 'download', after: { employeeId: document.employeeId } });
    return document;
  }

  async createSalaryProfile(session: SessionContext, employeeId: string, input: { effectiveFrom: string; basicSalary: number; housingAllowance?: number; transportAllowance?: number; otherAllowance?: number; overtimeRate?: number; currency?: string }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: employeeId, companyId: session.companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (input.basicSalary < 0) throw new BadRequestException('basicSalary cannot be negative');
    return this.prisma.hRSalaryProfile.create({ data: { companyId: session.companyId, employeeId, effectiveFrom: requiredDate(input.effectiveFrom, 'effectiveFrom'), basicSalary: input.basicSalary, housingAllowance: input.housingAllowance ?? 0, transportAllowance: input.transportAllowance ?? 0, otherAllowance: input.otherAllowance ?? 0, overtimeRate: input.overtimeRate ?? 1.25, currency: input.currency || 'AED' } });
  }

  async listLeaveBalances(session: SessionContext, employeeId?: string, year = new Date().getFullYear()) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = employeeId && isAdmin(session)
      ? await this.prisma.hREmployee.findFirst({ where: { id: employeeId, companyId: session.companyId }, select: { id: true } })
      : await this.employeeForSession(session);
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.hRLeaveBalance.findMany({ where: { companyId: session.companyId, employeeId: employee.id, year }, include: { leaveType: true }, orderBy: { leaveType: { name: 'asc' } } });
  }

  async savePolicy(session: SessionContext, input: Record<string, unknown>) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const number = (key: string, fallback: number) => typeof input[key] === 'number' && Number.isFinite(input[key]) ? input[key] as number : fallback;
    return this.prisma.hRPolicyProfile.upsert({
      where: { companyId: session.companyId },
      create: { companyId: session.companyId, jurisdiction: typeof input.jurisdiction === 'string' ? input.jurisdiction : 'mainland', payFrequency: typeof input.payFrequency === 'string' ? input.payFrequency : 'monthly', standardHoursPerDay: number('standardHoursPerDay', 8), workingDaysPerWeek: number('workingDaysPerWeek', 6), overtimeMultiplier: number('overtimeMultiplier', 1.25), annualLeaveDays: number('annualLeaveDays', 30), sickLeaveDays: number('sickLeaveDays', 90), currency: typeof input.currency === 'string' ? input.currency : 'AED' },
      update: { ...(typeof input.jurisdiction === 'string' ? { jurisdiction: input.jurisdiction } : {}), ...(typeof input.payFrequency === 'string' ? { payFrequency: input.payFrequency } : {}), standardHoursPerDay: number('standardHoursPerDay', 8), workingDaysPerWeek: number('workingDaysPerWeek', 6), overtimeMultiplier: number('overtimeMultiplier', 1.25), annualLeaveDays: number('annualLeaveDays', 30), sickLeaveDays: number('sickLeaveDays', 90), currency: typeof input.currency === 'string' ? input.currency : 'AED' },
    });
  }

  async createLeavePolicy(session: SessionContext, input: { leaveTypeId: string; annualDays: number; carryForwardDays?: number; effectiveFrom: string; effectiveTo?: string | null; employmentType?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const leaveType = await this.prisma.hRLeaveType.findFirst({ where: { id: input.leaveTypeId, companyId: session.companyId } });
    if (!leaveType || input.annualDays < 0) throw new BadRequestException('Valid leave type and annual days are required');
    return this.prisma.hRLeavePolicy.create({ data: { companyId: session.companyId, leaveTypeId: input.leaveTypeId, annualDays: input.annualDays, carryForwardDays: input.carryForwardDays ?? 0, effectiveFrom: requiredDate(input.effectiveFrom, 'effectiveFrom'), effectiveTo: date(input.effectiveTo), employmentType: input.employmentType?.trim() || null } });
  }

  async payslip(session: SessionContext, entryId: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const entry = await this.prisma.hRPayrollEntry.findFirst({ where: { id: entryId, companyId: session.companyId, ...(isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } }) }, include: { period: true, employee: { select: { employeeNumber: true, firstName: true, lastName: true, bankAccountLast4: true } } } });
    if (!entry) throw new NotFoundException('Payslip not found');
    if (!['locked', 'paid'].includes(entry.period.status) && !isAdmin(session)) throw new ForbiddenException('Payslip is not available yet');
    return { ...entry, breakdown: entry.breakdownJson ? JSON.parse(entry.breakdownJson) : null, documentStatus: 'ready-for-pdf-pipeline' };
  }

  async createPerformanceGoal(session: SessionContext, input: { employeeId: string; title: string; description?: string; periodStart: string; periodEnd: string; target?: string }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.title.trim()) throw new BadRequestException('title is required');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.hRPerformanceGoal.create({ data: { companyId: session.companyId, employeeId: employee.id, title: input.title.trim(), description: input.description?.trim() || null, periodStart: requiredDate(input.periodStart, 'periodStart'), periodEnd: requiredDate(input.periodEnd, 'periodEnd'), target: input.target?.trim() || null } });
  }

  async createTrainingRecord(session: SessionContext, input: { employeeId: string; title: string; provider?: string; completedAt?: string | null; expiryDate?: string | null; certificateUrl?: string | null; status?: string; notes?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.title.trim()) throw new BadRequestException('title is required');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.hRTrainingRecord.create({ data: { companyId: session.companyId, employeeId: employee.id, title: input.title.trim(), provider: input.provider?.trim() || null, completedAt: date(input.completedAt), expiryDate: date(input.expiryDate), certificateUrl: input.certificateUrl?.trim() || null, status: input.status || 'planned', notes: input.notes?.trim() || null } });
  }

  async listPerformance(session: SessionContext) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const scope = isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } };
    const [goals, training] = await Promise.all([
      this.prisma.hRPerformanceGoal.findMany({ where: { companyId: session.companyId, ...scope }, orderBy: { periodStart: 'desc' } }),
      this.prisma.hRTrainingRecord.findMany({ where: { companyId: session.companyId, ...scope }, orderBy: { expiryDate: 'asc' } }),
    ]);
    return { goals, training };
  }

  async attendance(session: SessionContext, from?: string, to?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    return this.prisma.hRAttendance.findMany({
      where: {
        companyId: session.companyId,
        ...(isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } }),
        ...(from || to ? { checkInAt: { ...(from ? { gte: date(from)! } : {}), ...(to ? { lte: date(to)! } : {}) } } : {}),
      },
      orderBy: { checkInAt: 'desc' },
      include: { employee: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } }, workLocation: true },
    });
  }

  async checkIn(session: SessionContext, input: { context?: string; workLocationId?: string | null; latitude?: number; longitude?: number; accuracyMeters?: number; devicePlatform?: string; capturedAt?: string }) {
    const employee = await this.employeeForSession(session);
    const open = await this.prisma.hRAttendance.findFirst({ where: { companyId: employee.companyId, employeeId: employee.id, checkOutAt: null } });
    if (open) throw new ConflictException('You already have an open attendance session.');
    const capturedAt = input.capturedAt ? date(input.capturedAt) : new Date();
    const row = await this.prisma.hRAttendance.create({
      data: {
        companyId: employee.companyId,
        employeeId: employee.id,
        workLocationId: input.workLocationId || null,
        checkInAt: new Date(),
        capturedAt: capturedAt!,
        context: input.context || 'office',
        latitude: typeof input.latitude === 'number' ? input.latitude : null,
        longitude: typeof input.longitude === 'number' ? input.longitude : null,
        accuracyMeters: typeof input.accuracyMeters === 'number' ? input.accuracyMeters : null,
        devicePlatform: input.devicePlatform || null,
        suspicious: typeof input.accuracyMeters === 'number' && input.accuracyMeters > 500,
      },
    });
    await this.audit.write({ companyId: employee.companyId, actorId: session.userId, entityType: 'HRAttendance', entityId: row.id, action: 'check_in', after: row });
    return row;
  }

  async checkOut(session: SessionContext) {
    const employee = await this.employeeForSession(session);
    const open = await this.prisma.hRAttendance.findFirst({ where: { companyId: employee.companyId, employeeId: employee.id, checkOutAt: null }, orderBy: { checkInAt: 'desc' } });
    if (!open) throw new NotFoundException('No open attendance session');
    const row = await this.prisma.hRAttendance.update({ where: { id: open.id }, data: { checkOutAt: new Date() } });
    await this.audit.write({ companyId: employee.companyId, actorId: session.userId, entityType: 'HRAttendance', entityId: row.id, action: 'check_out', after: row });
    return row;
  }

  async breakAttendance(session: SessionContext, start: boolean) {
    const employee = await this.employeeForSession(session);
    const open = await this.prisma.hRAttendance.findFirst({ where: { companyId: employee.companyId, employeeId: employee.id, checkOutAt: null }, orderBy: { checkInAt: 'desc' } });
    if (!open) throw new NotFoundException('No open attendance session');
    return this.prisma.hRAttendance.update({ where: { id: open.id }, data: start ? { breakStartedAt: new Date() } : { breakEndedAt: new Date() } });
  }

  async correctAttendance(session: SessionContext, id: string, input: { checkInAt?: string; checkOutAt?: string | null; correctionNote: string }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.correctionNote?.trim()) throw new BadRequestException('correctionNote is required');
    const before = await this.prisma.hRAttendance.findFirst({ where: { id, companyId: session.companyId } });
    if (!before) throw new NotFoundException('Attendance record not found');
    const row = await this.prisma.hRAttendance.update({
      where: { id },
      data: {
        checkInAt: input.checkInAt ? requiredDate(input.checkInAt, 'checkInAt') : undefined,
        checkOutAt: input.checkOutAt === null ? null : input.checkOutAt ? requiredDate(input.checkOutAt, 'checkOutAt') : undefined,
        correctionNote: input.correctionNote.trim(),
      },
    });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HRAttendance', entityId: id, action: 'correct', before, after: row });
    return row;
  }

  async createOvertime(
    session: SessionContext,
    input: { employeeId?: string; workDate: string; startedAt: string; endedAt: string; breakMinutes?: number; reason: string },
  ) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = isAdmin(session) && input.employeeId
      ? await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId, status: 'active' } })
      : await this.employeeForSession(session);
    if (!employee) throw new NotFoundException('Employee not found');
    const startedAt = requiredDate(input.startedAt, 'startedAt');
    const endedAt = requiredDate(input.endedAt, 'endedAt');
    const hours = (endedAt.getTime() - startedAt.getTime()) / 3_600_000 - (input.breakMinutes ?? 0) / 60;
    if (hours <= 0) throw new BadRequestException('Overtime duration must be positive');
    const row = await this.prisma.hROvertimeRequest.create({
      data: {
        companyId: session.companyId,
        employeeId: employee.id,
        workDate: requiredDate(input.workDate, 'workDate'),
        startedAt,
        endedAt,
        breakMinutes: Math.max(0, Math.floor(input.breakMinutes ?? 0)),
        requestedHours: Number(hours.toFixed(2)),
        reason: input.reason.trim(),
      },
    });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HROvertimeRequest', entityId: row.id, action: 'create', after: row });
    return row;
  }

  async listOvertime(session: SessionContext, status?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    return this.prisma.hROvertimeRequest.findMany({
      where: { companyId: session.companyId, ...(status ? { status } : {}), ...(isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } }) },
      orderBy: { workDate: 'desc' },
      include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } },
    });
  }

  async reviewOvertime(session: SessionContext, id: string, input: { status: 'approved' | 'rejected'; approvedHours?: number }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const before = await this.prisma.hROvertimeRequest.findFirst({ where: { id, companyId: session.companyId } });
    if (!before) throw new NotFoundException('Overtime request not found');
    if (before.status !== 'pending') throw new ConflictException('Overtime request is already reviewed');
    const row = await this.prisma.hROvertimeRequest.update({
      where: { id },
      data: {
        status: input.status,
        approvedHours: input.status === 'approved' ? Math.min(before.requestedHours, Math.max(0, input.approvedHours ?? before.requestedHours)) : 0,
        reviewedByUserId: session.userId,
        reviewedAt: new Date(),
      },
    });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HROvertimeRequest', entityId: id, action: input.status, before, after: row });
    return row;
  }

  async listLeaveTypes(session: SessionContext) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const rows = await this.prisma.hRLeaveType.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } });
    if (rows.length) return rows;
    await this.prisma.hRLeaveType.createMany({
      data: [
        { companyId: session.companyId, name: 'Annual leave', code: 'annual', paid: true },
        { companyId: session.companyId, name: 'Sick leave', code: 'sick', paid: true },
        { companyId: session.companyId, name: 'Unpaid leave', code: 'unpaid', paid: false },
      ],
      skipDuplicates: true,
    });
    return this.prisma.hRLeaveType.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } });
  }

  async createLeaveType(session: SessionContext, input: { name: string; code: string; paid?: boolean }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.name.trim() || !input.code.trim()) throw new BadRequestException('name and code are required');
    return this.prisma.hRLeaveType.create({ data: { companyId: session.companyId, name: input.name.trim(), code: input.code.trim().toLowerCase(), paid: input.paid ?? true } });
  }

  async updateLeaveType(
    session: SessionContext,
    id: string,
    input: { name?: string | null; code?: string | null; paid?: boolean; active?: boolean },
  ) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const before = await this.prisma.hRLeaveType.findFirst({ where: { id, companyId: session.companyId } });
    if (!before) throw new NotFoundException('Leave type not found');
    const row = await this.prisma.hRLeaveType.update({
      where: { id },
      data: {
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
        ...(input.code?.trim() ? { code: input.code.trim().toLowerCase() } : {}),
        ...(typeof input.paid === 'boolean' ? { paid: input.paid } : {}),
        ...(typeof input.active === 'boolean' ? { active: input.active } : {}),
      },
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'HRLeaveType',
      entityId: id,
      action: 'update',
      before,
      after: row,
    });
    return row;
  }

  async listLeaveRequests(session: SessionContext, status?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    return this.prisma.hRLeaveRequest.findMany({
      where: { companyId: session.companyId, ...(status ? { status } : {}), ...(isAdmin(session) || session.readOnly ? {} : { employee: { userId: session.userId } }) },
      orderBy: { startDate: 'desc' },
      include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } }, leaveType: true },
    });
  }

  async createLeaveRequest(session: SessionContext, input: { employeeId?: string; leaveTypeId: string; startDate: string; endDate: string; reason?: string }) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = isAdmin(session) && input.employeeId
      ? await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId, status: 'active' } })
      : await this.employeeForSession(session);
    if (!employee) throw new NotFoundException('Employee not found');
    const startDate = requiredDate(input.startDate, 'startDate');
    const endDate = requiredDate(input.endDate, 'endDate');
    if (endDate < startDate) throw new BadRequestException('endDate must be on or after startDate');
    const leaveType = await this.prisma.hRLeaveType.findFirst({ where: { id: input.leaveTypeId, companyId: session.companyId, active: true } });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    const overlap = await this.prisma.hRLeaveRequest.findFirst({
      where: { companyId: session.companyId, employeeId: employee.id, status: { in: ['pending', 'approved'] }, startDate: { lte: endDate }, endDate: { gte: startDate } },
    });
    if (overlap) throw new ConflictException('Leave dates overlap an existing request');
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
    const row = await this.prisma.hRLeaveRequest.create({ data: { companyId: session.companyId, employeeId: employee.id, leaveTypeId: leaveType.id, startDate, endDate, days, reason: input.reason?.trim() || null } });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HRLeaveRequest', entityId: row.id, action: 'create', after: row });
    return row;
  }

  async reviewLeave(session: SessionContext, id: string, input: { status: 'approved' | 'rejected' | 'cancelled'; note?: string }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const before = await this.prisma.hRLeaveRequest.findFirst({ where: { id, companyId: session.companyId } });
    if (!before) throw new NotFoundException('Leave request not found');
    if (before.status !== 'pending' && input.status !== 'cancelled') throw new ConflictException('Leave request is already finalized');
    const row = await this.prisma.hRLeaveRequest.update({ where: { id }, data: { status: input.status, reviewedByUserId: session.userId, reviewedAt: new Date(), reviewNote: input.note?.trim() || null } });
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HRLeaveRequest', entityId: id, action: input.status, before, after: row });
    return row;
  }

  async listPayroll(session: SessionContext) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    return this.prisma.hRPayrollPeriod.findMany({
      where: { companyId: session.companyId },
      orderBy: { startDate: 'desc' },
      include: { entries: { include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } } } },
    });
  }

  async createPayrollPeriod(session: SessionContext, input: { name: string; startDate: string; endDate: string; payDate?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const startDate = requiredDate(input.startDate, 'startDate');
    const endDate = requiredDate(input.endDate, 'endDate');
    if (endDate < startDate) throw new BadRequestException('endDate must be on or after startDate');
    return this.prisma.hRPayrollPeriod.create({ data: { companyId: session.companyId, name: input.name.trim(), startDate, endDate, payDate: date(input.payDate) } });
  }

  async calculatePayroll(session: SessionContext, periodId: string) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const period = await this.prisma.hRPayrollPeriod.findFirst({ where: { id: periodId, companyId: session.companyId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (['locked', 'paid'].includes(period.status)) throw new ConflictException('Locked payroll cannot be recalculated');
    const employees = await this.prisma.hREmployee.findMany({
      where: { companyId: session.companyId, status: 'active' },
      include: {
        salaryProfiles: {
          where: { effectiveFrom: { lte: period.endDate }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.startDate } }] },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
        },
        overtime: { where: { status: 'approved', workDate: { gte: period.startDate, lte: period.endDate } } },
        leaveRequests: { where: { status: 'approved', startDate: { lte: period.endDate }, endDate: { gte: period.startDate } }, include: { leaveType: true } },
      },
    });
    const entries = [];
    for (const employee of employees) {
      const salary = employee.salaryProfiles[0];
      const basic = salary?.basicSalary ?? 0;
      const allowances = (salary?.housingAllowance ?? 0) + (salary?.transportAllowance ?? 0) + (salary?.otherAllowance ?? 0);
      const overtimeAmount = employee.overtime.reduce((sum, row) => sum + (row.approvedHours ?? 0) * (salary?.overtimeRate ?? 1.25) * (basic / 208), 0);
      const unpaidLeaveDeduction = employee.leaveRequests.filter((row) => !row.leaveType.paid).reduce((sum, row) => sum + row.days * (basic / 30), 0);
      const grossAmount = basic + allowances + overtimeAmount;
      const deductions = unpaidLeaveDeduction;
      entries.push(await this.prisma.hRPayrollEntry.upsert({
        where: { periodId_employeeId: { periodId, employeeId: employee.id } },
        create: { companyId: session.companyId, periodId, employeeId: employee.id, basicSalary: basic, allowances, overtimeAmount, unpaidLeaveDeduction, grossAmount, deductions, netAmount: grossAmount - deductions, breakdownJson: JSON.stringify({ basic, allowances, overtimeAmount, unpaidLeaveDeduction }) },
        update: { basicSalary: basic, allowances, overtimeAmount, unpaidLeaveDeduction, grossAmount, deductions, netAmount: grossAmount - deductions, breakdownJson: JSON.stringify({ basic, allowances, overtimeAmount, unpaidLeaveDeduction }) },
      }));
    }
    const totals = entries.reduce((sum, entry) => ({ gross: sum.gross + entry.grossAmount, deductions: sum.deductions + entry.deductions, net: sum.net + entry.netAmount }), { gross: 0, deductions: 0, net: 0 });
    return this.prisma.hRPayrollPeriod.update({ where: { id: periodId }, data: { status: 'calculated', calculatedAt: new Date(), totalGross: totals.gross, totalDeductions: totals.deductions, totalNet: totals.net }, include: { entries: true } });
  }

  async updatePayrollStatus(session: SessionContext, periodId: string, status: 'approved' | 'locked' | 'paid') {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const period = await this.prisma.hRPayrollPeriod.findFirst({ where: { id: periodId, companyId: session.companyId } });
    if (!period) throw new NotFoundException('Payroll period not found');
    const allowed: Record<string, string[]> = { approved: ['calculated'], locked: ['approved'], paid: ['locked'] };
    if (!allowed[status]?.includes(period.status)) throw new ConflictException(`Cannot move payroll from ${period.status} to ${status}`);
    const timestamp = new Date();
    return this.prisma.hRPayrollPeriod.update({ where: { id: periodId }, data: { status, ...(status === 'approved' ? { approvedAt: timestamp } : {}), ...(status === 'locked' ? { lockedAt: timestamp } : {}), ...(status === 'paid' ? { paidAt: timestamp } : {}) } });
  }

  async wpsExport(session: SessionContext, periodId: string) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const period = await this.prisma.hRPayrollPeriod.findFirst({ where: { id: periodId, companyId: session.companyId }, include: { entries: { include: { employee: true } } } });
    if (!period) throw new NotFoundException('Payroll period not found');
    if (!['locked', 'paid'].includes(period.status)) throw new ConflictException('Payroll must be locked before WPS export');
    const missingBank = period.entries.filter((entry) => !entry.employee.ibanLast4);
    if (missingBank.length) throw new BadRequestException(`${missingBank.length} employee(s) are missing bank details`);
    const quote = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
    const lines = [
      'employee_number,employee_name,iban_last4,pay_date,net_amount,currency',
      ...period.entries.map((entry) => [
        entry.employee.employeeNumber,
        `${entry.employee.firstName} ${entry.employee.lastName || ''}`.trim(),
        entry.employee.ibanLast4,
        period.payDate?.toISOString().slice(0, 10) || '',
        entry.netAmount.toFixed(2),
        'AED',
      ].map(quote).join(',')),
    ];
    await this.audit.write({ companyId: session.companyId, actorId: session.userId, entityType: 'HRPayrollPeriod', entityId: periodId, action: 'wps_export', after: { count: period.entries.length } });
    return { filename: `wps-${period.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`, content: lines.join('\n'), records: period.entries.length };
  }

  async finalSettlement(session: SessionContext, employeeId: string, terminationDate?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: employeeId, companyId: session.companyId, ...(!isAdmin(session) ? { userId: session.userId } : {}) }, include: { salaryProfiles: { orderBy: { effectiveFrom: 'desc' }, take: 1 }, leaveRequests: { where: { status: 'approved' } }, loans: { where: { status: 'active' } } } });
    if (!employee) throw new NotFoundException('Employee not found');
    const end = terminationDate ? requiredDate(terminationDate, 'terminationDate') : new Date();
    const years = Math.max(0, (end.getTime() - employee.joiningDate.getTime()) / (365.25 * 86_400_000));
    const basic = employee.salaryProfiles[0]?.basicSalary ?? 0;
    const gratuityDays = Math.min(years, 5) * 21 + Math.max(0, years - 5) * 30;
    const gratuity = basic / 30 * gratuityDays;
    return { employeeId, terminationDate: end.toISOString(), serviceYears: Number(years.toFixed(2)), gratuityDays: Number(gratuityDays.toFixed(2)), gratuity: Number(gratuity.toFixed(2)), outstandingLoans: employee.loans.reduce((sum, loan) => sum + loan.outstanding, 0), approvedLeaveDays: employee.leaveRequests.reduce((sum, leave) => sum + leave.days, 0), currency: employee.salaryProfiles[0]?.currency || 'AED', disclaimer: 'Configurable estimate; company and legal review required.' };
  }

  async listExtended(session: SessionContext) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const [expenses, loans, benefits, assets, compliance] = await Promise.all([
      this.prisma.hRExpenseClaim.findMany({ where: { companyId: session.companyId }, orderBy: { expenseDate: 'desc' }, include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } } }),
      this.prisma.hRLoan.findMany({ where: { companyId: session.companyId }, orderBy: { startDate: 'desc' }, include: { employee: { select: { employeeNumber: true, firstName: true, lastName: true } } } }),
      this.prisma.hRBenefitPlan.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
      this.prisma.hRAsset.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' }, include: { assignment: true } }),
      this.prisma.hRComplianceRecord.findMany({ where: { companyId: session.companyId }, orderBy: { expiryDate: 'asc' } }),
    ]);
    return { expenses, loans, benefits, assets, compliance };
  }

  async createExpense(session: SessionContext, input: { employeeId?: string; expenseDate: string; category: string; amount: number; description: string; receiptUrl?: string | null }) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const employee = isAdmin(session) && input.employeeId
      ? await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } })
      : await this.employeeForSession(session);
    if (!employee) throw new NotFoundException('Employee not found');
    if (input.amount <= 0 || !input.description.trim()) throw new BadRequestException('Positive amount and description are required');
    return this.prisma.hRExpenseClaim.create({ data: { companyId: session.companyId, employeeId: employee.id, expenseDate: requiredDate(input.expenseDate, 'expenseDate'), category: input.category.trim(), amount: input.amount, description: input.description.trim(), receiptUrl: input.receiptUrl?.trim() || null } });
  }

  async createLoan(session: SessionContext, input: { employeeId: string; kind: string; principal: number; installment: number; startDate: string; endDate?: string | null; notes?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || input.principal <= 0 || input.installment <= 0) throw new BadRequestException('Positive principal and installment are required');
    const employee = await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return this.prisma.hRLoan.create({ data: { companyId: session.companyId, employeeId: employee.id, kind: input.kind.trim(), principal: input.principal, outstanding: input.principal, installment: input.installment, startDate: requiredDate(input.startDate, 'startDate'), endDate: date(input.endDate), notes: input.notes?.trim() || null } });
  }

  async reviewExpense(session: SessionContext, id: string, status: 'approved' | 'rejected' | 'reimbursed') {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const row = await this.prisma.hRExpenseClaim.findFirst({ where: { id, companyId: session.companyId } });
    if (!row) throw new NotFoundException('Expense claim not found');
    return this.prisma.hRExpenseClaim.update({ where: { id }, data: { status, reviewedByUserId: session.userId, reviewedAt: new Date(), ...(status === 'reimbursed' ? { reimbursedAt: new Date() } : {}) } });
  }

  async createBenefit(session: SessionContext, input: { name: string; kind: string; provider?: string; expiryDate?: string | null; notes?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.name.trim()) throw new BadRequestException('name is required');
    return this.prisma.hRBenefitPlan.create({ data: { companyId: session.companyId, name: input.name.trim(), kind: input.kind.trim(), provider: input.provider?.trim() || null, expiryDate: date(input.expiryDate), notes: input.notes?.trim() || null } });
  }

  async createAsset(session: SessionContext, input: { assetType: string; name: string; serialNumber?: string; condition?: string; purchasedAt?: string | null; notes?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.name.trim()) throw new BadRequestException('name is required');
    return this.prisma.hRAsset.create({ data: { companyId: session.companyId, assetType: input.assetType.trim(), name: input.name.trim(), serialNumber: input.serialNumber?.trim() || null, condition: input.condition?.trim() || null, purchasedAt: date(input.purchasedAt), notes: input.notes?.trim() || null } });
  }

  async assignAsset(session: SessionContext, assetId: string, input: { employeeId: string; assignedAt?: string; handoverNote?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const [asset, employee] = await Promise.all([
      this.prisma.hRAsset.findFirst({ where: { id: assetId, companyId: session.companyId, status: 'available' } }),
      this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId, status: 'active' } }),
    ]);
    if (!asset || !employee) throw new NotFoundException('Available asset or employee not found');
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.hRAssetAssignment.create({ data: { companyId: session.companyId, assetId, employeeId: employee.id, assignedAt: date(input.assignedAt) ?? new Date(), handoverNote: input.handoverNote?.trim() || null } });
      await tx.hRAsset.update({ where: { id: assetId }, data: { status: 'assigned' } });
      return assignment;
    });
  }

  async returnAsset(session: SessionContext, assetId: string, note?: string) {
    this.requireAdmin(session);
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    const assignment = await this.prisma.hRAssetAssignment.findFirst({ where: { assetId, companyId: session.companyId, returnedAt: null } });
    if (!assignment) throw new NotFoundException('Active asset assignment not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.hRAssetAssignment.update({ where: { id: assignment.id }, data: { returnedAt: new Date(), handoverNote: note?.trim() || assignment.handoverNote } });
      await tx.hRAsset.update({ where: { id: assetId }, data: { status: 'available' } });
      return updated;
    });
  }

  async createCompliance(session: SessionContext, input: { kind: string; employeeId?: string | null; status?: string; reference?: string; issueDate?: string | null; expiryDate?: string | null; notes?: string | null }) {
    this.requireAdmin(session);
    if (!isCompanySession(session) || !input.kind.trim()) throw new BadRequestException('kind is required');
    if (input.employeeId && !(await this.prisma.hREmployee.findFirst({ where: { id: input.employeeId, companyId: session.companyId } }))) throw new NotFoundException('Employee not found');
    return this.prisma.hRComplianceRecord.create({ data: { companyId: session.companyId, kind: input.kind.trim(), employeeId: input.employeeId || null, status: input.status || 'open', reference: input.reference?.trim() || null, issueDate: date(input.issueDate), expiryDate: date(input.expiryDate), notes: input.notes?.trim() || null } });
  }

  async report(session: SessionContext, from?: string, to?: string) {
    if (!isCompanySession(session)) throw new ForbiddenException('Company session required.');
    if (!isAdmin(session) && !session.readOnly) throw new ForbiddenException('Company admin access required.');
    const where = { companyId: session.companyId, ...(from || to ? { createdAt: { ...(from ? { gte: date(from)! } : {}), ...(to ? { lte: date(to)! } : {}) } } : {}) };
    const [headcount, attendance, leave, overtime, expenses, payroll] = await Promise.all([
      this.prisma.hREmployee.groupBy({ by: ['status'], where: { companyId: session.companyId }, _count: { _all: true } }),
      this.prisma.hRAttendance.count({ where }),
      this.prisma.hRLeaveRequest.count({ where }),
      this.prisma.hROvertimeRequest.aggregate({ where, _sum: { approvedHours: true } }),
      this.prisma.hRExpenseClaim.aggregate({ where, _sum: { amount: true } }),
      this.prisma.hRPayrollPeriod.aggregate({ where, _sum: { totalNet: true } }),
    ]);
    return { headcount, attendanceRecords: attendance, leaveRequests: leave, approvedOvertimeHours: overtime._sum.approvedHours ?? 0, expenseTotal: expenses._sum.amount ?? 0, payrollNet: payroll._sum.totalNet ?? 0 };
  }
}
