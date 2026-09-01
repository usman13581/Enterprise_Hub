import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, StreamableFile, NotFoundException, UseGuards } from '@nestjs/common';
import { createReadStream, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { HrService } from './hr.service';
import { UPLOADS_DIR } from '../uploads/uploads.constants';
import { zodBody } from '../common/zod-validation.pipe';
import {
  hrApprovalSchema,
  hrAttendanceCheckInSchema,
  hrEmployeeSchema,
  hrEmployeeUpdateSchema,
  hrLeaveRequestSchema,
  hrLeaveReviewSchema,
  hrOrganizationSchema,
  hrOrganizationUpdateSchema,
  hrLeaveTypeSchema,
  hrLeaveTypeUpdateSchema,
  hrOvertimeSchema,
  hrPayrollPeriodSchema,
  type HREmployeeUpdateInput,
} from '@marble/types';

@Controller('company/hr')
@UseGuards(BootstrapAuthGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('dashboard')
  dashboard(@CurrentSession() session: SessionContext) {
    return this.hr.dashboard(session);
  }

  @Get('employees')
  employees(@CurrentSession() session: SessionContext, @Query('status') status?: string) {
    return this.hr.listEmployees(session, status);
  }

  @Get('employees/:id')
  employee(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.hr.getEmployee(session, id);
  }

  @Post('employees')
  createEmployee(@CurrentSession() session: SessionContext, @Body(zodBody(hrEmployeeSchema)) body: Parameters<HrService['createEmployee']>[1]) {
    return this.hr.createEmployee(session, body);
  }

  @Patch('employees/:id')
  updateEmployee(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(hrEmployeeUpdateSchema)) body: HREmployeeUpdateInput,
  ) {
    return this.hr.updateEmployee(session, id, body);
  }

  @Delete('employees/:id')
  deleteEmployee(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.hr.deleteEmployee(session, id);
  }

  @Get('organization')
  organization(@CurrentSession() session: SessionContext, @Query('all') all?: string) {
    return this.hr.listOrganization(session, all === 'true');
  }

  @Post('organization')
  createOrganization(@CurrentSession() session: SessionContext, @Body(zodBody(hrOrganizationSchema)) body: Parameters<HrService['createOrganization']>[1]) {
    return this.hr.createOrganization(session, body);
  }

  @Patch('organization/:id')
  updateOrganization(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(hrOrganizationUpdateSchema)) body: Parameters<HrService['updateOrganization']>[2],
  ) {
    return this.hr.updateOrganization(session, id, body);
  }

  @Get('employees/:employeeId/documents')
  documents(@CurrentSession() session: SessionContext, @Param('employeeId') employeeId: string) {
    return this.hr.listDocuments(session, employeeId);
  }

  @Post('employees/:employeeId/documents')
  createDocument(@CurrentSession() session: SessionContext, @Param('employeeId') employeeId: string, @Body() body: Record<string, unknown>) {
    return this.hr.createDocument(session, employeeId, body);
  }

  @Get('documents/expiring')
  expiringDocuments(@CurrentSession() session: SessionContext, @Query('days') days?: string) {
    return this.hr.expiringDocuments(session, days ? Number(days) : 30);
  }

  @Get('documents/:id')
  async document(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    const document = await this.hr.getDocument(session, id);
    return Object.fromEntries(Object.entries(document).filter(([key]) => key !== 'fileUrl'));
  }

  @Get('documents/:id/download')
  async downloadDocument(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    const document = await this.hr.getDocument(session, id);
    if (!document.fileUrl?.startsWith('/static/')) throw new NotFoundException('Document file is not available');
    const filename = basename(document.fileUrl);
    if (!filename || filename === '.' || filename === '..') throw new BadRequestException('Invalid document file');
    const path = join(UPLOADS_DIR, filename);
    if (!existsSync(path)) throw new NotFoundException('Document file is not available');
    return new StreamableFile(createReadStream(path), {
      type: 'application/octet-stream',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Post('employees/:employeeId/salary')
  createSalaryProfile(@CurrentSession() session: SessionContext, @Param('employeeId') employeeId: string, @Body() body: Parameters<HrService['createSalaryProfile']>[2]) {
    return this.hr.createSalaryProfile(session, employeeId, body);
  }

  @Get('employees/:employeeId/leave-balances')
  leaveBalances(@CurrentSession() session: SessionContext, @Param('employeeId') employeeId: string, @Query('year') year?: string) {
    return this.hr.listLeaveBalances(session, employeeId, year ? Number(year) : undefined);
  }

  @Post('policy')
  savePolicy(@CurrentSession() session: SessionContext, @Body() body: Record<string, unknown>) {
    return this.hr.savePolicy(session, body);
  }

  @Get('attendance')
  attendance(@CurrentSession() session: SessionContext, @Query('from') from?: string, @Query('to') to?: string) {
    return this.hr.attendance(session, from, to);
  }

  @Post('attendance/check-in')
  checkIn(@CurrentSession() session: SessionContext, @Body(zodBody(hrAttendanceCheckInSchema)) body: Parameters<HrService['checkIn']>[1]) {
    return this.hr.checkIn(session, body);
  }

  @Post('attendance/check-out')
  checkOut(@CurrentSession() session: SessionContext) {
    return this.hr.checkOut(session);
  }

  @Post('attendance/break')
  attendanceBreak(@CurrentSession() session: SessionContext, @Body() body: { start: boolean }) {
    return this.hr.breakAttendance(session, !!body.start);
  }

  @Patch('attendance/:id')
  correctAttendance(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: Parameters<HrService['correctAttendance']>[2]) {
    return this.hr.correctAttendance(session, id, body);
  }

  @Get('overtime')
  overtime(@CurrentSession() session: SessionContext, @Query('status') status?: string) {
    return this.hr.listOvertime(session, status);
  }

  @Post('overtime')
  createOvertime(@CurrentSession() session: SessionContext, @Body(zodBody(hrOvertimeSchema)) body: Parameters<HrService['createOvertime']>[1]) {
    return this.hr.createOvertime(session, body);
  }

  @Patch('overtime/:id')
  reviewOvertime(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body(zodBody(hrApprovalSchema)) body: Parameters<HrService['reviewOvertime']>[2]) {
    return this.hr.reviewOvertime(session, id, body);
  }

  @Get('leave-types')
  leaveTypes(@CurrentSession() session: SessionContext) {
    return this.hr.listLeaveTypes(session);
  }

  @Post('leave-types')
  createLeaveType(@CurrentSession() session: SessionContext, @Body(zodBody(hrLeaveTypeSchema)) body: Parameters<HrService['createLeaveType']>[1]) {
    return this.hr.createLeaveType(session, body);
  }

  @Patch('leave-types/:id')
  updateLeaveType(
    @CurrentSession() session: SessionContext,
    @Param('id') id: string,
    @Body(zodBody(hrLeaveTypeUpdateSchema)) body: Parameters<HrService['updateLeaveType']>[2],
  ) {
    return this.hr.updateLeaveType(session, id, body);
  }

  @Post('leave-policies')
  createLeavePolicy(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createLeavePolicy']>[1]) {
    return this.hr.createLeavePolicy(session, body);
  }

  @Get('leave-requests')
  leaveRequests(@CurrentSession() session: SessionContext, @Query('status') status?: string) {
    return this.hr.listLeaveRequests(session, status);
  }

  @Post('leave-requests')
  createLeaveRequest(@CurrentSession() session: SessionContext, @Body(zodBody(hrLeaveRequestSchema)) body: Parameters<HrService['createLeaveRequest']>[1]) {
    return this.hr.createLeaveRequest(session, body);
  }

  @Patch('leave-requests/:id')
  reviewLeave(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body(zodBody(hrLeaveReviewSchema)) body: Parameters<HrService['reviewLeave']>[2]) {
    return this.hr.reviewLeave(session, id, body);
  }

  @Get('payroll')
  payroll(@CurrentSession() session: SessionContext) {
    return this.hr.listPayroll(session);
  }

  @Get('payroll/entries/:id/payslip')
  payslip(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.hr.payslip(session, id);
  }

  @Post('payroll/periods')
  createPayrollPeriod(@CurrentSession() session: SessionContext, @Body(zodBody(hrPayrollPeriodSchema)) body: Parameters<HrService['createPayrollPeriod']>[1]) {
    return this.hr.createPayrollPeriod(session, body);
  }

  @Post('payroll/periods/:id/calculate')
  calculatePayroll(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.hr.calculatePayroll(session, id);
  }

  @Patch('payroll/periods/:id/status')
  updatePayrollStatus(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: { status: 'approved' | 'locked' | 'paid' }) {
    return this.hr.updatePayrollStatus(session, id, body.status);
  }

  @Get('payroll/periods/:id/wps')
  wps(@CurrentSession() session: SessionContext, @Param('id') id: string) {
    return this.hr.wpsExport(session, id);
  }

  @Get('employees/:employeeId/final-settlement')
  finalSettlement(@CurrentSession() session: SessionContext, @Param('employeeId') employeeId: string, @Query('terminationDate') terminationDate?: string) {
    return this.hr.finalSettlement(session, employeeId, terminationDate);
  }

  @Get('extended')
  extended(@CurrentSession() session: SessionContext) {
    return this.hr.listExtended(session);
  }

  @Post('expenses')
  createExpense(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createExpense']>[1]) {
    return this.hr.createExpense(session, body);
  }

  @Post('loans')
  createLoan(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createLoan']>[1]) {
    return this.hr.createLoan(session, body);
  }

  @Patch('expenses/:id')
  reviewExpense(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: { status: 'approved' | 'rejected' | 'reimbursed' }) {
    return this.hr.reviewExpense(session, id, body.status);
  }

  @Post('benefits')
  createBenefit(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createBenefit']>[1]) {
    return this.hr.createBenefit(session, body);
  }

  @Post('assets')
  createAsset(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createAsset']>[1]) {
    return this.hr.createAsset(session, body);
  }

  @Post('assets/:id/assign')
  assignAsset(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: Parameters<HrService['assignAsset']>[2]) {
    return this.hr.assignAsset(session, id, body);
  }

  @Post('assets/:id/return')
  returnAsset(@CurrentSession() session: SessionContext, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.hr.returnAsset(session, id, body.note);
  }

  @Post('compliance')
  createCompliance(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createCompliance']>[1]) {
    return this.hr.createCompliance(session, body);
  }

  @Get('performance')
  performance(@CurrentSession() session: SessionContext) {
    return this.hr.listPerformance(session);
  }

  @Post('performance/goals')
  createPerformanceGoal(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createPerformanceGoal']>[1]) {
    return this.hr.createPerformanceGoal(session, body);
  }

  @Post('performance/training')
  createTrainingRecord(@CurrentSession() session: SessionContext, @Body() body: Parameters<HrService['createTrainingRecord']>[1]) {
    return this.hr.createTrainingRecord(session, body);
  }

  @Get('reports/summary')
  report(@CurrentSession() session: SessionContext, @Query('from') from?: string, @Query('to') to?: string) {
    return this.hr.report(session, from, to);
  }
}
