import { User } from '../types';

export const USERS: User[] = [
  { id: 'STU-001', name: 'Kavei', role: 'student' },
  { id: 'STU-002', name: 'Gautham', role: 'student' },
  { id: 'STU-003', name: 'Tarun', role: 'student' },
  { id: 'STU-004', name: 'Diya',  role: 'student' },
  { id: 'ADM-001', name: 'Admin', role: 'admin'   },
];

export const findUser = (id: string) => USERS.find(u => u.id === id);