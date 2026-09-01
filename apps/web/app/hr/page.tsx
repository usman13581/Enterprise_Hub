'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { Pagination, SearchBox, Toast } from '@/components/ListControls';
import { EmptyState, Stat, TableScroll, EditIconButton } from '@/components/Finance';
import { HRLookupsPanel } from '@/components/HRLookupsPanel';
import { searchItems, useFlash, usePagination, usePolledList } from '@/lib/useCollection';
import type { HREmployee, HRDashboard, HRLeaveRequest, HRPayrollPeriod } from '@marble/types';
import { HR_GOV_ID } from '@marble/types';
import { dateInputValue, todayIso } from '@/lib/dates';
import { amount, moneyHeader } from '@/lib/format';
import page from '../page.module.css';
import styles from '@/components/crud.module.css';
import finance from '@/components/finance.module.css';

type Organization = {
  departments: Array<{ id: string; name: string }>;
  designations: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  holidays: Array<{ id: string; name: string; date: string }>;
};
type EmployeeDocument = { id: string; documentType: string; expiryDate: string | null; status: string; employee: { employeeNumber: string; firstName: string; lastName: string | null } };

type EmployeeDraft = {
  firstName: string;
  lastName: string;
  preferredName: string;
  email: string;
  phone: string;
  nationality: string;
  status: string;
  departmentId: string;
  designationId: string;
  joiningDate: string;
  notes: string;
  emiratesIdNumber: string;
  emiratesIdExpiry: string;
  passportNumber: string;
  passportExpiry: string;
  visaExpiry: string;
  workPermitExpiry: string;
};

function emptyEmployee(): EmployeeDraft {
  return {
    firstName: '',
    lastName: '',
    preferredName: '',
    email: '',
    phone: '',
    nationality: '',
    status: 'active',
    departmentId: '',
    designationId: '',
    joiningDate: todayIso(),
    notes: '',
    emiratesIdNumber: '',
    emiratesIdExpiry: '',
    passportNumber: '',
    passportExpiry: '',
    visaExpiry: '',
    workPermitExpiry: '',
  };
}

function employeeLabel(employee?: { employeeNumber: string; firstName: string; lastName: string | null }) {
  if (!employee) return 'Unknown employee';
  const name = `${employee.firstName} ${employee.lastName || ''}`.trim();
  return name ? `${name} · ${employee.employeeNumber}` : employee.employeeNumber;
}

export default function HrPage() {
  const [tab, setTab] = useState<'overview' | 'employees' | 'documents' | 'attendance' | 'leave' | 'payroll' | 'extended' | 'reports' | 'lookups'>('overview');
  const [dashboard, setDashboard] = useState<HRDashboard | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const { items: employees, error, setError, reload } = usePolledList<HREmployee>('/company/hr/employees');
  const { items: leaveRequests, reload: reloadLeave } = usePolledList<HRLeaveRequest>('/company/hr/leave-requests');
  const { items: payroll } = usePolledList<HRPayrollPeriod>('/company/hr/payroll');
  const { flash, notify } = useFlash();
  const [query, setQuery] = useState('');
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState<EmployeeDraft>(emptyEmployee());
  const [attendance, setAttendance] = useState<Array<{ id: string; checkInAt: string; checkOutAt: string | null; employee: { firstName: string; lastName: string | null } }>>([]);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; name: string; paid: boolean }>>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [report, setReport] = useState<{ headcount: Array<{ status: string; _count: { _all: number } }>; attendanceRecords: number; leaveRequests: number; approvedOvertimeHours: number; expenseTotal: number; payrollNet: number } | null>(null);

  useEffect(() => {
    void Promise.all([
      apiFetch<HRDashboard>('/company/hr/dashboard'),
      apiFetch<Organization>('/company/hr/organization'),
      apiFetch<typeof leaveTypes>('/company/hr/leave-types'),
    ]).then(([summary, org, types]) => {
      setDashboard(summary);
      setOrganization(org);
      setLeaveTypes(types);
    }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load HR'));
  }, [setError]);

  useEffect(() => {
    if (tab === 'attendance') {
      void apiFetch<typeof attendance>('/company/hr/attendance').then(setAttendance).catch((err) => setError(err instanceof Error ? err.message : 'Could not load attendance'));
    }
  }, [tab, setError]);

  useEffect(() => {
    if (tab === 'documents') void apiFetch<EmployeeDocument[]>('/company/hr/documents/expiring?days=365').then(setDocuments).catch((err) => setError(err instanceof Error ? err.message : 'Could not load documents'));
    if (tab === 'reports') void apiFetch<typeof report>('/company/hr/reports/summary').then(setReport).catch((err) => setError(err instanceof Error ? err.message : 'Could not load HR report'));
  }, [tab, setError]);

  const filtered = useMemo(() => searchItems(employees, query), [employees, query]);
  const pager = usePagination(filtered, query);

  async function reloadOrganization() {
    const [org, types] = await Promise.all([
      apiFetch<Organization>('/company/hr/organization'),
      apiFetch<typeof leaveTypes>('/company/hr/leave-types'),
    ]);
    setOrganization(org);
    setLeaveTypes(types);
  }

  function startCreateEmployee() {
    setEmployee(emptyEmployee());
    setEditingEmployeeId(null);
    setShowEmployeeForm(true);
  }

  async function startEditEmployee(item: HREmployee) {
    try {
      const detail = await apiFetch<HREmployee & { notes?: string | null }>(
        `/company/hr/employees/${item.id}`,
      );
      setEmployee({
        firstName: detail.firstName,
        lastName: detail.lastName ?? '',
        preferredName: detail.preferredName ?? '',
        email: detail.email ?? '',
        phone: detail.phone ?? '',
        nationality: detail.nationality ?? '',
        status: detail.status,
        departmentId: detail.departmentId ?? '',
        designationId: detail.designationId ?? '',
        joiningDate: dateInputValue(detail.joiningDate),
        notes: detail.notes ?? '',
        emiratesIdNumber: detail.emiratesIdNumber ?? '',
        emiratesIdExpiry: dateInputValue(detail.emiratesIdExpiry),
        passportNumber: detail.passportNumber ?? '',
        passportExpiry: dateInputValue(detail.passportExpiry),
        visaExpiry: dateInputValue(detail.visaExpiry),
        workPermitExpiry: dateInputValue(detail.workPermitExpiry),
      });
      setEditingEmployeeId(item.id);
      setShowEmployeeForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load employee');
    }
  }

  async function saveEmployee(event: React.FormEvent) {
    event.preventDefault();
    if (!employee.firstName.trim() || saving) return;
    setSaving(true);
    const payload = {
      firstName: employee.firstName,
      lastName: employee.lastName || null,
      preferredName: employee.preferredName || null,
      email: employee.email || null,
      phone: employee.phone || null,
      nationality: employee.nationality || null,
      status: employee.status,
      departmentId: employee.departmentId || null,
      designationId: employee.designationId || null,
      joiningDate: employee.joiningDate,
      notes: employee.notes || null,
      emiratesIdNumber: employee.emiratesIdNumber || null,
      emiratesIdExpiry: employee.emiratesIdExpiry || null,
      passportNumber: employee.passportNumber || null,
      passportExpiry: employee.passportExpiry || null,
      visaExpiry: employee.visaExpiry || null,
      workPermitExpiry: employee.workPermitExpiry || null,
    };
    try {
      if (editingEmployeeId) {
        await apiPatch(`/company/hr/employees/${editingEmployeeId}`, payload);
        notify('Employee updated');
      } else {
        await apiPost('/company/hr/employees', payload);
        notify('Employee added');
      }
      setEmployee(emptyEmployee());
      setEditingEmployeeId(null);
      setShowEmployeeForm(false);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employee');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!editingEmployeeId || saving) return;
    const target = employees.find((item) => item.id === editingEmployeeId);
    const label = target
      ? `${target.firstName} ${target.lastName || ''}`.trim()
      : 'this employee';
    if (!window.confirm(`Permanently delete ${label}? Attendance, leave, and payroll history for this employee will also be removed.`)) {
      return;
    }
    setSaving(true);
    try {
      await apiDelete(`/company/hr/employees/${editingEmployeeId}`);
      setEmployee(emptyEmployee());
      setEditingEmployeeId(null);
      setShowEmployeeForm(false);
      await reload();
      notify('Employee deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete employee');
    } finally {
      setSaving(false);
    }
  }

  async function reviewLeave(id: string, status: 'approved' | 'rejected') {
    try {
      await apiPatch(`/company/hr/leave-requests/${id}`, { status });
      await reloadLeave();
      notify(`Leave ${status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update leave');
    }
  }

  async function calculate(periodId: string) {
    try {
      await apiPost(`/company/hr/payroll/periods/${periodId}/calculate`, {});
      notify('Payroll calculated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate payroll');
    }
  }

  return (
    <section className={page.page}>
      <h1 className={page.title}>Human Resource</h1>
      {error ? <p className={styles.error}>{error}</p> : null}
      <nav aria-label="HR sections" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        {(['overview', 'employees', 'documents', 'attendance', 'leave', 'payroll', 'extended', 'reports', 'lookups'] as const).map((item) => (
          <button key={item} className={tab === item ? styles.button : styles.ghost} onClick={() => setTab(item)}>
            {item === 'lookups' ? 'Lookups' : item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {tab === 'overview' && dashboard ? (
        <>
          <div className={finance.statGrid}>
            <Stat title="Active employees" value={String(dashboard.activeEmployees)} hint={`${dashboard.employees} total records`} />
            <Stat title="Open attendance" value={String(dashboard.openAttendance)} />
            <Stat title="Pending leave" value={String(dashboard.pendingLeave)} />
            <Stat title="Expiring documents" value={String(dashboard.expiringDocuments)} hint="Within 30 days" />
          </div>
          <div className={styles.form}>
            <h2 className={styles.formTitle}>Organization setup</h2>
            <div className={styles.grid}>
              <div><strong>Departments</strong><p>{organization?.departments.map((item) => item.name).join(', ') || 'None configured'}</p></div>
              <div><strong>Designations</strong><p>{organization?.designations.map((item) => item.name).join(', ') || 'None configured'}</p></div>
              <div><strong>Work locations</strong><p>{organization?.locations.map((item) => item.name).join(', ') || 'None configured'}</p></div>
              <div><strong>Holidays</strong><p>{organization?.holidays.length ?? 0} configured</p></div>
            </div>
          </div>
        </>
      ) : null}

      {tab === 'employees' ? (
        <>
          <div className={styles.toolbar}><span className={styles.count}>{employees.length} employees</span>{dashboard?.canManage ? <button className={styles.button} type="button" onClick={startCreateEmployee}>Add employee</button> : null}</div>
          {showEmployeeForm ? (
            <form className={styles.form} onSubmit={saveEmployee}>
              <h2 className={styles.formTitle}>{editingEmployeeId ? 'Edit employee' : 'New employee'}</h2>
              <div className={styles.grid}>
                <label className={styles.field}><span className={styles.label}>First name *</span><input className={styles.input} required value={employee.firstName} onChange={(event) => setEmployee({ ...employee, firstName: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Last name</span><input className={styles.input} value={employee.lastName} onChange={(event) => setEmployee({ ...employee, lastName: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Preferred name</span><input className={styles.input} value={employee.preferredName} onChange={(event) => setEmployee({ ...employee, preferredName: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Email</span><input className={styles.input} type="email" value={employee.email} onChange={(event) => setEmployee({ ...employee, email: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Phone</span><input className={styles.input} value={employee.phone} onChange={(event) => setEmployee({ ...employee, phone: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Nationality</span><input className={styles.input} value={employee.nationality} onChange={(event) => setEmployee({ ...employee, nationality: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={employee.status} onChange={(event) => setEmployee({ ...employee, status: event.target.value })}><option value="active">Active</option><option value="on_leave">On leave</option><option value="probation">Probation</option><option value="inactive">Inactive</option><option value="terminated">Terminated</option></select></label>
                <label className={styles.field}><span className={styles.label}>Department</span><select className={styles.select} value={employee.departmentId} onChange={(event) => setEmployee({ ...employee, departmentId: event.target.value })}><option value="">None</option>{organization?.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className={styles.field}><span className={styles.label}>Designation</span><select className={styles.select} value={employee.designationId} onChange={(event) => setEmployee({ ...employee, designationId: event.target.value })}><option value="">None</option>{organization?.designations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label className={styles.field}><span className={styles.label}>Joining date *</span><input className={styles.input} type="date" required value={employee.joiningDate} onChange={(event) => setEmployee({ ...employee, joiningDate: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>{HR_GOV_ID.number}</span><input className={styles.input} value={employee.emiratesIdNumber} onChange={(event) => setEmployee({ ...employee, emiratesIdNumber: event.target.value })} placeholder={HR_GOV_ID.numberPlaceholder} /></label>
                <label className={styles.field}><span className={styles.label}>{HR_GOV_ID.expiry}</span><input className={styles.input} type="date" value={employee.emiratesIdExpiry} onChange={(event) => setEmployee({ ...employee, emiratesIdExpiry: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Passport number</span><input className={styles.input} value={employee.passportNumber} onChange={(event) => setEmployee({ ...employee, passportNumber: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Passport expiry</span><input className={styles.input} type="date" value={employee.passportExpiry} onChange={(event) => setEmployee({ ...employee, passportExpiry: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Visa expiry</span><input className={styles.input} type="date" value={employee.visaExpiry} onChange={(event) => setEmployee({ ...employee, visaExpiry: event.target.value })} /></label>
                <label className={styles.field}><span className={styles.label}>Work permit expiry</span><input className={styles.input} type="date" value={employee.workPermitExpiry} onChange={(event) => setEmployee({ ...employee, workPermitExpiry: event.target.value })} /></label>
                <label className={styles.field} style={{ gridColumn: '1 / -1' }}><span className={styles.label}>Notes</span><textarea className={styles.input} rows={3} value={employee.notes} onChange={(event) => setEmployee({ ...employee, notes: event.target.value })} /></label>
              </div>
              <div className={styles.actions}>
                <button className={styles.button} disabled={saving}>{saving ? 'Saving…' : editingEmployeeId ? 'Save changes' : 'Save employee'}</button>
                <button className={styles.ghost} type="button" onClick={() => { setShowEmployeeForm(false); setEditingEmployeeId(null); setEmployee(emptyEmployee()); }}>Cancel</button>
                {editingEmployeeId ? <button className={`${styles.ghost} ${styles.danger}`} type="button" disabled={saving} onClick={() => void deleteEmployee()}>Delete employee</button> : null}
              </div>
            </form>
          ) : null}
          <SearchBox value={query} onChange={setQuery} placeholder="Search employees…" />
          {filtered.length ? <TableScroll><table className={finance.table}><thead><tr><th>Employee</th><th>Email</th><th>{HR_GOV_ID.column}</th><th>Number</th><th>Department</th><th>Type</th><th>Status</th><th>Joining</th>{dashboard?.canManage ? <th /> : null}</tr></thead><tbody>{pager.paged.map((item) => <tr key={item.id}><td><div className={finance.cellStack}><strong>{item.preferredName || `${item.firstName} ${item.lastName || ''}`.trim()}</strong>{item.phone ? <span className={finance.cellSub}>{item.phone}</span> : null}</div></td><td>{item.email || '—'}</td><td><div className={finance.cellStack}><span>{item.emiratesIdNumber || '—'}</span>{item.emiratesIdExpiry ? <span className={finance.cellSub}>expires {new Date(item.emiratesIdExpiry).toLocaleDateString()}</span> : null}</div></td><td>{item.employeeNumber}</td><td>{item.department?.name || '—'}</td><td>{item.employmentType.replace('_', ' ')}</td><td>{item.status}</td><td>{new Date(item.joiningDate).toLocaleDateString()}</td>{dashboard?.canManage ? <td><EditIconButton label={`Edit ${item.firstName}`} onClick={() => startEditEmployee(item)} /></td> : null}</tr>)}</tbody></table></TableScroll> : <EmptyState>No employees match this search.</EmptyState>}
          <Pagination page={pager.page} setPage={pager.setPage} pageSize={pager.pageSize} setPageSize={pager.setPageSize} pageCount={pager.pageCount} total={pager.total} />
        </>
      ) : null}

      {tab === 'attendance' ? <><div className={styles.toolbar}><span className={styles.count}>{attendance.length} attendance records</span></div>{attendance.length ? <TableScroll><table className={finance.table}><thead><tr><th>Employee</th><th>Check in</th><th>Check out</th><th>Context</th></tr></thead><tbody>{attendance.map((item) => <tr key={item.id}><td>{item.employee.firstName} {item.employee.lastName || ''}</td><td>{new Date(item.checkInAt).toLocaleString()}</td><td>{item.checkOutAt ? new Date(item.checkOutAt).toLocaleString() : 'Open'}</td><td>Server recorded</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No attendance recorded.</EmptyState>}</> : null}

      {tab === 'documents' ? <>{documents.length ? <TableScroll><table className={finance.table}><thead><tr><th>Employee</th><th>Document</th><th>Expiry</th><th>Status</th></tr></thead><tbody>{documents.map((item) => <tr key={item.id}><td>{item.employee.firstName} {item.employee.lastName || ''} · {item.employee.employeeNumber}</td><td>{item.documentType}</td><td>{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'No expiry'}</td><td>{item.status}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No expiring documents.</EmptyState>}<p className={styles.count}>Document contents are never included in expiry reports; authorized document access is audited.</p></> : null}

      {tab === 'leave' ? <><div className={styles.toolbar}><span className={styles.count}>{leaveRequests.length} requests · {leaveTypes.length} leave types</span></div>{leaveRequests.length ? <TableScroll><table className={finance.table}><thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th>Days</th><th>Status</th><th /></tr></thead><tbody>{leaveRequests.map((item) => <tr key={item.id}><td>{employeeLabel(item.employee)}</td><td>{item.leaveType?.name || 'Leave'}</td><td>{new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}</td><td>{item.days}</td><td>{item.status}</td><td>{item.status === 'pending' && dashboard?.canManage ? <><button className={styles.ghost} onClick={() => void reviewLeave(item.id, 'approved')}>Approve</button> <button className={`${styles.ghost} ${styles.danger}`} onClick={() => void reviewLeave(item.id, 'rejected')}>Reject</button></> : null}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No leave requests.</EmptyState>}</> : null}

      {tab === 'payroll' ? <><div className={styles.toolbar}><span className={styles.count}>{payroll.length} payroll periods</span></div>{payroll.length ? <TableScroll><table className={finance.table}><thead><tr><th>Period</th><th>Dates</th><th>Status</th><th className={finance.numeric}>{moneyHeader('Net')}</th><th /></tr></thead><tbody>{payroll.map((item) => <tr key={item.id}><td>{item.name}</td><td>{new Date(item.startDate).toLocaleDateString()} – {new Date(item.endDate).toLocaleDateString()}</td><td>{item.status}</td><td className={finance.numeric}>{amount(item.totalNet)}</td><td>{item.status === 'draft' || item.status === 'calculated' ? <button className={styles.ghost} onClick={() => void calculate(item.id)}>Calculate</button> : null}</td></tr>)}</tbody></table></TableScroll> : <EmptyState>No payroll periods. Create one through the HR API when your salary profiles are ready.</EmptyState>}</> : null}

      {tab === 'extended' ? <div className={styles.form}><h2 className={styles.formTitle}>Extended HR operations</h2><p>Expenses, loans, benefits, assets, and compliance are company-scoped in the HR API and ready for their detailed workflows.</p></div> : null}
      {tab === 'reports' && report ? <div className={finance.statGrid}><Stat title="Attendance records" value={String(report.attendanceRecords)} /><Stat title="Leave requests" value={String(report.leaveRequests)} /><Stat title="Approved overtime" value={`${report.approvedOvertimeHours.toFixed(2)} h`} /><Stat title={moneyHeader('Payroll net')} value={amount(report.payrollNet)} /></div> : null}
      {tab === 'lookups' ? (
        <HRLookupsPanel
          canManage={Boolean(dashboard?.canManage)}
          onChanged={() => void reloadOrganization().catch((err) => setError(err instanceof Error ? err.message : 'Could not refresh organization'))}
        />
      ) : null}
      <Toast flash={flash} />
    </section>
  );
}
