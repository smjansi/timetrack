export type Role = 'employee' | 'manager';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
}
