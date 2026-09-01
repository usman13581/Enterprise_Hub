const AUTH_ROUTE = /^(login|admin-login|change-password|index)$/;

const ADMIN_SECTION_LABELS: Record<string, string> = {
  companies: 'Companies',
  applications: 'Applications',
  plans: 'Plans',
  subscriptions: 'Subscriptions',
  renewals: 'Renewals',
  notifications: 'Notifications',
  support: 'Support',
  audit: 'Audit',
};

const MODULE_DETAIL_PARENT: Record<string, { label: string; href: string }> = {
  supplier: { label: 'Suppliers', href: '/module/suppliers' },
  'purchase-invoices': {
    label: 'Purchase invoices',
    href: '/module/purchase-invoices',
  },
  lpos: { label: 'Purchase Orders', href: '/module/purchase-orders' },
  'purchase-orders': {
    label: 'Purchase Orders',
    href: '/module/purchase-orders',
  },
};

export function isLoginRoute(segments: readonly string[]) {
  const root = segments[0];
  return root === 'login' || root === 'admin-login';
}

export function isCompanyHomeRoute(segments: readonly string[]) {
  if (segments.length === 0) return true;
  return segments.length === 1 && segments[0] === 'index';
}

export function isRootRoute(segments: readonly string[]) {
  if (segments.length === 0) return true;
  if (segments.length === 1 && segments[0] === 'index') return true;
  if (segments[0] === 'login' || segments[0] === 'admin-login') return true;
  if (segments[0] === 'change-password') return true;
  if (segments[0] === 'admin' && segments.length === 1) return true;
  if (segments[0] === 'admin' && segments.length === 2 && segments[1] === 'index') {
    return true;
  }
  return false;
}

export function isAuthRouteName(name: string | undefined) {
  if (!name) return false;
  const leaf = name.split('/').pop() ?? name;
  return AUTH_ROUTE.test(leaf) || AUTH_ROUTE.test(name);
}

export function smartBackLabel(segments: readonly string[]) {
  const [area, section, third] = segments;
  if (area === 'admin') {
    if (third) return ADMIN_SECTION_LABELS[section ?? ''] ?? 'Admin';
    return 'Admin';
  }
  if (area === 'module') {
    if (third) return MODULE_DETAIL_PARENT[section ?? '']?.label ?? 'Home';
    return 'Home';
  }
  return 'Back';
}

export function smartBackHref(segments: readonly string[]) {
  const [area, section, third] = segments;
  if (area === 'admin') {
    if (third && section === 'companies') return '/admin/companies';
    return '/admin';
  }
  if (area === 'module') {
    if (third) {
      return MODULE_DETAIL_PARENT[section ?? '']?.href ?? '/';
    }
    return '/';
  }
  return '/';
}

type NavState = {
  index: number;
  routes: Array<{ name?: string; key?: string }>;
};

export function shouldReplaceInsteadOfBack(
  state: NavState | undefined,
): boolean {
  if (!state || state.index <= 0) return true;
  for (let index = state.index - 1; index >= 0; index -= 1) {
    if (isAuthRouteName(state.routes[index]?.name)) return true;
  }
  return false;
}

export function resetToAppHome(router: { replace: (href: never) => void }) {
  router.replace('/' as never);
}

export function resetToAdminHome(router: { replace: (href: never) => void }) {
  router.replace('/admin' as never);
}

export function navigateAfterAuth(
  router: {
    dismissAll?: () => void;
    replace: (href: never) => void;
  },
  href: string,
) {
  if (typeof router.dismissAll === 'function') {
    router.dismissAll();
  }
  router.replace(href as never);
}
