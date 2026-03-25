/**
 * Client-side fetch wrappers for /api/indoor/* (session cookie auth).
 */

export interface IndoorContext {
  organizations: { id: string; name: string }[];
  organizationId: string | null;
  venues: { id: string; name: string }[];
}

export async function getIndoorContext(organizationId?: string): Promise<IndoorContext> {
  const url = organizationId
    ? `/api/indoor/context?organization_id=${encodeURIComponent(organizationId)}`
    : '/api/indoor/context';
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function createOrganization(name: string): Promise<{ id: string; name: string }> {
  const res = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getIndoorList(
  resource: string,
  params: Record<string, string>
): Promise<unknown[]> {
  const q = new URLSearchParams(params).toString();
  const res = await fetch(`/api/indoor/${resource}?${q}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function getIndoorOne(resource: string, id: string): Promise<unknown> {
  const res = await fetch(`/api/indoor/${resource}/${id}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function postIndoor(resource: string, body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`/api/indoor/${resource}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function patchIndoor(
  resource: string,
  id: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`/api/indoor/${resource}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function deleteIndoor(resource: string, id: string): Promise<void> {
  const res = await fetch(`/api/indoor/${resource}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}
