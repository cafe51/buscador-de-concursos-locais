import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

const JWT_SECRET_ENV = process.env.JWT_SECRET || 'fallback-secret-at-least-32-characters-long';
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_ENV);

export interface JWTPayload {
  id: string;
  email: string;
  username: string;
  role: string;
}

export interface SessionUser {
  id: string;
  email: string;
  user_metadata: {
    username: string;
    role: string;
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

import connectToDatabase from './mongodb';
import { UserModel } from '../models/User';

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    let cookieStore;
    try {
      cookieStore = await cookies();
    } catch {
      return null;
    }

    const token = cookieStore.get('session')?.value;
    if (!token) return null;
    
    const payload = await verifyToken(token);
    if (!payload || !payload.id) return null;
    
    await connectToDatabase();
    const dbUser = await UserModel.findById(payload.id).lean();
    if (!dbUser) return null;

    return {
      id: dbUser._id.toString(),
      email: dbUser.email,
      user_metadata: {
        username: dbUser.username,
        role: dbUser.role || 'user',
      }
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  try {
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      path: '/',
    });
  } catch {
    // Prerender Context without cookies
  }
}

export async function deleteSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
  } catch {
    // Prerender Context without cookies
  }
}
