export type CompanySlug =
  | "v-tax"
  | "v-banking"
  | "v-business"
  | "v-corp"
  | "v-tech";

export interface Lesson {
  id: number;
  title: string;
  video_url?: string;
  text_content?: string;
}

export interface Module {
  id: number;
  title: string;
  module_order: number;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  title: string;
  company_slug: CompanySlug;
  modules: Module[];
}

export interface Company {
  id: number;
  name: string;
  slug: CompanySlug;
  active: boolean;
  primary_color?: string;
}

export interface Unit {
  id: number;
  name: string;
  company_slug: CompanySlug;
  created_at?: string;
}
