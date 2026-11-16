import { headers } from 'next/headers';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Viewer = { email: string; isCreator: boolean };

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function getViewer(requestHeaders?: Headers): Promise<Viewer | null> {
  const incoming = requestHeaders ?? await headers();
  let email: string;
  if (process.env.NODE_ENV !== 'production') {
    email = incoming.get('x-dev-user-email') ?? process.env.DEV_USER_EMAIL ?? 'dev@noholabs.com';
  } else {
    const token = incoming.get('Cf-Access-Jwt-Assertion');
    const domain = process.env.CF_ACCESS_TEAM_DOMAIN;
    const audience = process.env.CF_ACCESS_AUD;
    if (!token || !domain || !audience) return null;
    try {
      const issuer = `https://${domain.replace(/^https:\/\//, '').replace(/\/$/, '')}`;
      let keys = keySets.get(issuer);
      if (!keys) {
        keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
        keySets.set(issuer, keys);
      }
      const { payload } = await jwtVerify(token, keys, { audience, issuer });
      if (typeof payload.email !== 'string') return null;
      email = payload.email;
    } catch {
      return null;
    }
  }
  email = email.trim().toLowerCase();
  if (!email) return null;
  const creators = (process.env.CREATOR_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase());
  return { email, isCreator: creators.includes(email) };
}
