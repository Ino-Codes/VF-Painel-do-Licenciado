export interface Task {
  id: number;
  task_name: string;
  is_completed: boolean;
  responsible_user_id: number;
  due_date: string;
}

export interface Candidate {
  id: number;
  name: string;
  email: string;
  phone: string;
  role_applied_for: string;
  status: string;
  stage_id: number;
  user_id: number;
  stage_name?: string;
  responsible_name?: string;
  tasks?: Task[];
}

export interface Stage {
  id: number;
  name: string;
  stage_order: number;
}
