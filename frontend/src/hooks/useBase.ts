import { baseOf } from '@/layouts/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
export const useBase = () => baseOf(useAuth().user!.role);
