import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  View,
} from 'react-native';
import type {
  HREmployee,
  HRDashboard,
  HRLeaveRequest,
  HRPayrollPeriod,
} from '@marble/types';
import { HR_GOV_ID } from '@marble/types';
import { apiDelete, apiFetch, apiPatch, apiPost } from '../../lib/api';
import { isOnline } from '../../lib/offline/net';
import { queueAttendanceCapture } from '../../lib/offline/syncEngine';
import {
  searchItems,
  usePagination,
  usePolledItem,
  usePolledList,
} from '../../lib/useCollection';
import { Pagination, SearchBox } from '../../components/ListControls';
import { FormChipSelect, FormField } from '../../components/FormField';
import { ScreenScroll } from '../../components/ScreenScroll';
import { FilterChips, RecordRow, StatCard } from '../../components/Finance';
import { HRLookupsSection } from '../../components/HRLookupsSection';
import { day, label, money } from '../../lib/format';
import { colors, ui } from '../../lib/ui';

type Tab =
  | 'overview'
  | 'employees'
  | 'documents'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'extended'
  | 'reports'
  | 'lookups';

type Organization = {
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  holidays: Array<{ id: string; name: string; date: string }>;
};

type Attendance = {
  id: string;
  checkInAt: string;
  checkOutAt: string | null;
  context: string | null;
  employee: { firstName: string; lastName: string | null };
};

type Document = {
  id: string;
  documentType: string;
  expiryDate: string | null;
  status: string;
  employee: {
    employeeNumber: string;
    firstName: string;
    lastName: string | null;
  };
};

type HrReport = {
  headcount: Array<{ status: string; _count: { _all: number } }>;
  attendanceRecords: number;
  leaveRequests: number;
  approvedOvertimeHours: number;
  payrollNet: number;
};

const HR_TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'employees', label: 'Employees' },
  { key: 'documents', label: 'Documents' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'extended', label: 'Extended' },
  { key: 'reports', label: 'Reports' },
  { key: 'lookups', label: 'Lookups' },
];

const today = () => new Date().toISOString().slice(0, 10);

type EmployeeDraft = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  status: string;
  departmentId: string;
  designationId: string;
  joiningDate: string;
  emiratesIdNumber: string;
  emiratesIdExpiry: string;
  passportNumber: string;
  passportExpiry: string;
  visaExpiry: string;
  workPermitExpiry: string;
  notes: string;
};

const EMPTY_EMPLOYEE = (): EmployeeDraft => ({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  nationality: '',
  status: 'active',
  departmentId: '',
  designationId: '',
  joiningDate: today(),
  emiratesIdNumber: '',
  emiratesIdExpiry: '',
  passportNumber: '',
  passportExpiry: '',
  visaExpiry: '',
  workPermitExpiry: '',
  notes: '',
});

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '';
}

function employeeLabel(
  employee?: {
    employeeNumber: string;
    firstName: string;
    lastName: string | null;
  },
) {
  if (!employee) return 'Unknown employee';
  const name = `${employee.firstName} ${employee.lastName || ''}`.trim();
  return name ? `${name} · ${employee.employeeNumber}` : employee.employeeNumber;
}

function TabLoading() {
  return (
    <View style={styles.tabLoading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export default function HrScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  const {
    item: summary,
    loading: summaryLoading,
    error: summaryError,
    setError: setSummaryError,
    reload: reloadSummary,
  } = usePolledItem<HRDashboard>('/company/hr/dashboard');
  const {
    item: organization,
    loading: organizationLoading,
    error: organizationError,
    reload: reloadOrganization,
  } = usePolledItem<Organization>('/company/hr/organization');
  const {
    items: employees,
    loading: employeesLoading,
    error: employeesError,
    setError: setEmployeesError,
    reload: reloadEmployees,
  } = usePolledList<HREmployee>('/company/hr/employees');
  const {
    items: leaveRequests,
    loading: leaveLoading,
    reload: reloadLeave,
  } = usePolledList<HRLeaveRequest>('/company/hr/leave-requests');
  const {
    items: payroll,
    loading: payrollLoading,
    reload: reloadPayroll,
  } = usePolledList<HRPayrollPeriod>('/company/hr/payroll');

  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [report, setReport] = useState<HrReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeDraft>(EMPTY_EMPLOYEE());
  const [saving, setSaving] = useState(false);

  const error = summaryError || organizationError || employeesError;

  function setError(message: string) {
    setSummaryError(message);
    setEmployeesError(message);
  }

  useEffect(() => {
    if (tab !== 'attendance') return;
    setAttendanceLoading(true);
    void apiFetch<Attendance[]>('/company/hr/attendance')
      .then(setAttendance)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load attendance'),
      )
      .finally(() => setAttendanceLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'documents') return;
    setDocumentsLoading(true);
    void apiFetch<Document[]>('/company/hr/documents/expiring?days=365')
      .then(setDocuments)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load documents'),
      )
      .finally(() => setDocumentsLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== 'reports') return;
    setReportLoading(true);
    void apiFetch<HrReport>('/company/hr/reports/summary')
      .then(setReport)
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Could not load HR report'),
      )
      .finally(() => setReportLoading(false));
  }, [tab]);

  const filtered = useMemo(() => searchItems(employees, query), [employees, query]);
  const pager = usePagination(filtered, query);

  const bootLoading =
    summaryLoading &&
    !summary &&
    employeesLoading &&
    employees.length === 0;

  function startCreate() {
    setEmployee(EMPTY_EMPLOYEE());
    setEditingId(null);
    setShowForm(true);
  }

  async function startEdit(item: HREmployee) {
    try {
      const detail = await apiFetch<HREmployee & { notes?: string | null }>(
        `/company/hr/employees/${item.id}`,
      );
      setEmployee({
        firstName: detail.firstName,
        lastName: detail.lastName ?? '',
        email: detail.email ?? '',
        phone: detail.phone ?? '',
        nationality: detail.nationality ?? '',
        status: detail.status,
        departmentId: detail.departmentId ?? '',
        designationId: detail.designationId ?? '',
        joiningDate: toDateInput(detail.joiningDate),
        emiratesIdNumber: detail.emiratesIdNumber ?? '',
        emiratesIdExpiry: toDateInput(detail.emiratesIdExpiry),
        passportNumber: detail.passportNumber ?? '',
        passportExpiry: toDateInput(detail.passportExpiry),
        visaExpiry: toDateInput(detail.visaExpiry),
        workPermitExpiry: toDateInput(detail.workPermitExpiry),
        notes: detail.notes ?? '',
      });
      setEditingId(item.id);
      setShowForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load employee');
    }
  }

  async function saveEmployee() {
    if (!employee.firstName.trim() || saving) return;
    setSaving(true);
    const payload = {
      firstName: employee.firstName,
      lastName: employee.lastName || null,
      email: employee.email || null,
      phone: employee.phone || null,
      nationality: employee.nationality || null,
      status: employee.status,
      departmentId: employee.departmentId || null,
      designationId: employee.designationId || null,
      joiningDate: employee.joiningDate,
      emiratesIdNumber: employee.emiratesIdNumber || null,
      emiratesIdExpiry: employee.emiratesIdExpiry || null,
      passportNumber: employee.passportNumber || null,
      passportExpiry: employee.passportExpiry || null,
      visaExpiry: employee.visaExpiry || null,
      workPermitExpiry: employee.workPermitExpiry || null,
      notes: employee.notes || null,
    };
    try {
      if (editingId) {
        await apiPatch(`/company/hr/employees/${editingId}`, payload);
      } else {
        await apiPost('/company/hr/employees', payload);
      }
      setEmployee(EMPTY_EMPLOYEE());
      setEditingId(null);
      setShowForm(false);
      await Promise.all([
        reloadEmployees(),
        reloadSummary(),
        reloadOrganization(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employee');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editingId) return;
    const target = employees.find((item) => item.id === editingId);
    Alert.alert(
      'Delete employee',
      `Permanently delete ${target ? `${target.firstName} ${target.lastName || ''}`.trim() : 'this employee'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void deleteEmployee() },
      ],
    );
  }

  async function deleteEmployee() {
    if (!editingId || saving) return;
    setSaving(true);
    try {
      await apiDelete(`/company/hr/employees/${editingId}`);
      setEmployee(EMPTY_EMPLOYEE());
      setEditingId(null);
      setShowForm(false);
      await Promise.all([
        reloadEmployees(),
        reloadSummary(),
        reloadOrganization(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete employee');
    } finally {
      setSaving(false);
    }
  }

  async function reviewLeave(id: string, status: 'approved' | 'rejected') {
    try {
      await apiPatch(`/company/hr/leave-requests/${id}`, { status });
      await Promise.all([reloadLeave(), reloadSummary()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update leave');
    }
  }

  async function calculatePayroll(periodId: string) {
    try {
      await apiPost(`/company/hr/payroll/periods/${periodId}/calculate`, {});
      await reloadPayroll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate payroll');
    }
  }

  async function toggleAttendance() {
    try {
      const open = attendance.find((item) => !item.checkOutAt);
      if (open) {
        if (await isOnline()) await apiPost('/company/hr/attendance/check-out', {});
        else
          await queueAttendanceCapture({
            checkIn: false,
            capturedAt: new Date().toISOString(),
            devicePlatform: 'mobile',
          });
      } else {
        const capturedAt = new Date().toISOString();
        if (await isOnline()) {
          await apiPost('/company/hr/attendance/check-in', {
            context: 'mobile',
            devicePlatform: 'android-or-ios',
            capturedAt,
          });
        } else {
          await queueAttendanceCapture({
            checkIn: true,
            capturedAt,
            context: 'mobile',
            devicePlatform: 'android-or-ios',
          });
        }
      }
      if (await isOnline()) {
        setAttendance(await apiFetch<Attendance[]>('/company/hr/attendance'));
      }
      await reloadSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update attendance');
    }
  }

  if (bootLoading) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <ScreenScroll>
        <Text style={ui.title}>Human Resource</Text>
        <Text style={ui.lede}>
          People, attendance, leave, and payroll for your company.
        </Text>
        {error ? <Text style={ui.error}>{error}</Text> : null}

        <FilterChips
          scrollable
          active={tab}
          onChange={setTab}
          options={HR_TABS}
        />

        {tab === 'overview' ? (
          summaryLoading && !summary ? (
            <TabLoading />
          ) : summary ? (
            <>
              <View style={styles.stats}>
                <StatCard
                  title="Active employees"
                  value={String(summary.activeEmployees)}
                  hint={`${summary.employees} total records`}
                />
                <StatCard
                  title="Open attendance"
                  value={String(summary.openAttendance)}
                />
                <StatCard
                  title="Pending leave"
                  value={String(summary.pendingLeave)}
                />
                <StatCard
                  title="Expiring documents"
                  value={String(summary.expiringDocuments)}
                  hint="Within 30 days"
                />
              </View>
              <View style={ui.card}>
                <Text style={ui.cardTitle}>Organization setup</Text>
                {organizationLoading && !organization ? (
                  <TabLoading />
                ) : (
                  <>
                    <Text style={ui.cardMeta}>
                      Departments:{' '}
                      {organization?.departments.map((item) => item.name).join(', ') ||
                        'None configured'}
                    </Text>
                    <Text style={ui.cardMeta}>
                      Designations:{' '}
                      {organization?.designations
                        .map((item) => item.name)
                        .join(', ') || 'None configured'}
                    </Text>
                    <Text style={ui.cardMeta}>
                      Work locations:{' '}
                      {organization?.locations.map((item) => item.name).join(', ') ||
                        'None configured'}
                    </Text>
                    <Text style={ui.cardMeta}>
                      Holidays: {organization?.holidays.length ?? 0} configured
                    </Text>
                  </>
                )}
              </View>
            </>
          ) : (
            <View style={ui.empty}>
              <Text style={ui.emptyText}>Could not load HR overview.</Text>
            </View>
          )
        ) : null}

        {tab === 'employees' ? (
          <>
            <View style={ui.toolbar}>
              <Text style={ui.count}>{employees.length} employees</Text>
              {summary?.canManage ? (
                <Pressable style={ui.button} onPress={startCreate}>
                  <Text style={ui.buttonText}>Add</Text>
                </Pressable>
              ) : null}
            </View>
            {showForm ? (
              <View style={ui.card}>
                <Text style={ui.cardTitle}>
                  {editingId ? 'Edit employee' : 'New employee'}
                </Text>
                <FormField
                  first
                  required
                  label="First name"
                  value={employee.firstName}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, firstName: value })
                  }
                />
                <FormField
                  label="Last name"
                  value={employee.lastName}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, lastName: value })
                  }
                />
                <FormField
                  label="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={employee.email}
                  onChangeText={(value) => setEmployee({ ...employee, email: value })}
                />
                <FormField
                  label="Phone"
                  keyboardType="phone-pad"
                  value={employee.phone}
                  onChangeText={(value) => setEmployee({ ...employee, phone: value })}
                />
                <FormField
                  label="Nationality"
                  value={employee.nationality}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, nationality: value })
                  }
                />
                <FormChipSelect
                  label="Department"
                  value={employee.departmentId}
                  options={organization?.departments ?? []}
                  onChange={(departmentId) =>
                    setEmployee({ ...employee, departmentId })
                  }
                />
                <FormChipSelect
                  label="Designation"
                  value={employee.designationId}
                  options={organization?.designations ?? []}
                  onChange={(designationId) =>
                    setEmployee({ ...employee, designationId })
                  }
                />
                <FormField
                  label="Joining date"
                  placeholder="YYYY-MM-DD"
                  value={employee.joiningDate}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, joiningDate: value })
                  }
                />
                <FormField
                  label={HR_GOV_ID.number}
                  placeholder={HR_GOV_ID.numberPlaceholder}
                  value={employee.emiratesIdNumber}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, emiratesIdNumber: value })
                  }
                />
                <FormField
                  label={HR_GOV_ID.expiry}
                  placeholder="YYYY-MM-DD"
                  value={employee.emiratesIdExpiry}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, emiratesIdExpiry: value })
                  }
                />
                <FormField
                  label="Passport number"
                  value={employee.passportNumber}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, passportNumber: value })
                  }
                />
                <FormField
                  label="Passport expiry"
                  placeholder="YYYY-MM-DD"
                  value={employee.passportExpiry}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, passportExpiry: value })
                  }
                />
                <FormField
                  label="Visa expiry"
                  placeholder="YYYY-MM-DD"
                  value={employee.visaExpiry}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, visaExpiry: value })
                  }
                />
                <FormField
                  label="Work permit expiry"
                  placeholder="YYYY-MM-DD"
                  value={employee.workPermitExpiry}
                  onChangeText={(value) =>
                    setEmployee({ ...employee, workPermitExpiry: value })
                  }
                />
                <FormField
                  label="Notes"
                  multiline
                  style={styles.notesInput}
                  value={employee.notes}
                  onChangeText={(value) => setEmployee({ ...employee, notes: value })}
                />
                <View style={ui.cardActions}>
                  <Pressable
                    style={ui.button}
                    disabled={saving}
                    onPress={() => void saveEmployee()}
                  >
                    <Text style={ui.buttonText}>
                      {saving
                        ? 'Saving…'
                        : editingId
                          ? 'Save changes'
                          : 'Save employee'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={ui.ghost}
                    onPress={() => {
                      setShowForm(false);
                      setEditingId(null);
                      setEmployee(EMPTY_EMPLOYEE());
                    }}
                  >
                    <Text style={ui.ghostText}>Cancel</Text>
                  </Pressable>
                  {editingId ? (
                    <Pressable style={ui.ghost} onPress={confirmDelete}>
                      <Text style={[ui.ghostText, styles.dangerText]}>Delete</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            <SearchBox
              value={query}
              onChange={setQuery}
              placeholder="Search employees…"
            />
            {employeesLoading && employees.length === 0 ? (
              <TabLoading />
            ) : (
              <>
                {pager.paged.map((item) => (
                  <RecordRow
                    key={item.id}
                    title={`${item.firstName} ${item.lastName || ''}`.trim()}
                    meta={[
                      item.email,
                      item.emiratesIdNumber,
                      item.employeeNumber,
                      item.department?.name,
                      label(item.status),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    status={item.status}
                    onPress={
                      summary?.canManage ? () => void startEdit(item) : undefined
                    }
                  />
                ))}
                {pager.paged.length === 0 ? (
                  <View style={ui.empty}>
                    <Text style={ui.emptyText}>
                      {employees.length === 0
                        ? 'No employees yet.'
                        : 'No employees match this search.'}
                    </Text>
                  </View>
                ) : null}
                <Pagination
                  page={pager.page}
                  setPage={pager.setPage}
                  pageSize={pager.pageSize}
                  setPageSize={pager.setPageSize}
                  pageCount={pager.pageCount}
                  total={pager.total}
                />
              </>
            )}
          </>
        ) : null}

        {tab === 'attendance' ? (
          <>
            <Pressable style={ui.button} onPress={() => void toggleAttendance()}>
              <Text style={ui.buttonText}>
                {attendance.some((item) => !item.checkOutAt)
                  ? 'Check out'
                  : 'Check in'}
              </Text>
            </Pressable>
            {attendanceLoading ? (
              <TabLoading />
            ) : (
              <>
                {attendance.map((item) => (
                  <RecordRow
                    key={item.id}
                    title={`${item.employee.firstName} ${item.employee.lastName || ''}`.trim()}
                    meta={`${new Date(item.checkInAt).toLocaleString()} · ${
                      item.checkOutAt ? 'Closed' : 'Open'
                    } · ${item.context || 'office'}`}
                  />
                ))}
                {attendance.length === 0 ? (
                  <View style={ui.empty}>
                    <Text style={ui.emptyText}>No attendance recorded.</Text>
                  </View>
                ) : null}
              </>
            )}
          </>
        ) : null}

        {tab === 'documents' ? (
          documentsLoading ? (
            <TabLoading />
          ) : (
            <>
              {documents.map((item) => (
                <RecordRow
                  key={item.id}
                  title={item.documentType}
                  meta={`${employeeLabel(item.employee)} · ${
                    item.expiryDate
                      ? `expires ${day(item.expiryDate)}`
                      : 'No expiry'
                  }`}
                  status={item.status}
                />
              ))}
              {documents.length === 0 ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No expiring documents.</Text>
                </View>
              ) : null}
            </>
          )
        ) : null}

        {tab === 'leave' ? (
          leaveLoading && leaveRequests.length === 0 ? (
            <TabLoading />
          ) : (
            <>
              {leaveRequests.map((item) => (
                <RecordRow
                  key={item.id}
                  title={employeeLabel(item.employee)}
                  meta={`${item.leaveType?.name || 'Leave'} · ${day(item.startDate)} – ${day(item.endDate)} · ${item.days} days`}
                  status={item.status}
                >
                  {summary?.canManage && item.status === 'pending' ? (
                    <View style={styles.rowActions}>
                      <Pressable
                        style={ui.button}
                        onPress={() => void reviewLeave(item.id, 'approved')}
                      >
                        <Text style={ui.buttonText}>Approve</Text>
                      </Pressable>
                      <Pressable
                        style={ui.ghost}
                        onPress={() => void reviewLeave(item.id, 'rejected')}
                      >
                        <Text style={ui.ghostText}>Reject</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </RecordRow>
              ))}
              {leaveRequests.length === 0 ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No leave requests.</Text>
                </View>
              ) : null}
            </>
          )
        ) : null}

        {tab === 'payroll' ? (
          payrollLoading && payroll.length === 0 ? (
            <TabLoading />
          ) : (
            <>
              {payroll.map((item) => (
                <RecordRow
                  key={item.id}
                  title={item.name}
                  meta={`${day(item.startDate)} – ${day(item.endDate)} · ${label(item.status)} · Net ${money(item.totalNet)}`}
                  status={item.status}
                >
                  {item.status === 'draft' || item.status === 'calculated' ? (
                    <Pressable
                      style={ui.ghost}
                      onPress={() => void calculatePayroll(item.id)}
                    >
                      <Text style={ui.ghostText}>Calculate</Text>
                    </Pressable>
                  ) : null}
                </RecordRow>
              ))}
              {payroll.length === 0 ? (
                <View style={ui.empty}>
                  <Text style={ui.emptyText}>No payroll periods.</Text>
                </View>
              ) : null}
            </>
          )
        ) : null}

        {tab === 'extended' ? (
          <View style={ui.card}>
            <Text style={ui.cardTitle}>Extended HR operations</Text>
            <Text style={ui.cardMeta}>
              Expenses, loans, benefits, assets, and compliance are company-scoped
              in the HR API and ready for their detailed workflows.
            </Text>
          </View>
        ) : null}

        {tab === 'reports' ? (
          reportLoading && !report ? (
            <TabLoading />
          ) : report ? (
            <View style={styles.stats}>
              {report.headcount?.map((row) => (
                <StatCard
                  key={row.status}
                  title={`Headcount · ${label(row.status)}`}
                  value={String(row._count._all)}
                />
              ))}
              <StatCard
                title="Attendance records"
                value={String(report.attendanceRecords)}
              />
              <StatCard
                title="Leave requests"
                value={String(report.leaveRequests)}
              />
              <StatCard
                title="Approved overtime"
                value={`${report.approvedOvertimeHours.toFixed(2)} h`}
              />
              <StatCard
                title="Payroll net"
                value={money(report.payrollNet)}
              />
            </View>
          ) : (
            <View style={ui.empty}>
              <Text style={ui.emptyText}>Could not load HR report.</Text>
            </View>
          )
        ) : null}

        {tab === 'lookups' ? (
          <HRLookupsSection
            canManage={Boolean(summary?.canManage)}
            onChanged={() => void reloadOrganization()}
          />
        ) : null}
      </ScreenScroll>
    </View>
  );
}

const styles = {
  stats: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 4,
  },
  tabLoading: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 28,
  },
  rowActions: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 8,
  },
  dangerText: { color: colors.danger },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top' as const,
  },
};
