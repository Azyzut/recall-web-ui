import NextAuth from 'next-auth';
import { authConfig } from '@recall/shared/auth-config';

/**
 * Middleware using Edge-compatible auth config
 * Does NOT import bcrypt or database modules
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Match all routes except static files and api routes (except auth)
    '/((?!_next/static|_next/image|favicon.ico|api(?!/auth)).*)',
  ],
};
