import { DefaultSession } from 'next-auth';

export interface RoleObject {
  id: string;
  name: string;
  code: string;
}

export interface DesignationObject {
  id: string;
  name: string;
  code: string;
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: RoleObject;
      designation?: DesignationObject | null;
      empId?: string | null;
      alias?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: RoleObject;
    designation?: DesignationObject | null;
    empId?: string | null;
    alias?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: RoleObject;
    designation?: DesignationObject | null;
    empId?: string | null;
    alias?: string | null;
  }
}

