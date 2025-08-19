export interface Lesson {
  id: number;
  title: string;
  video_url?: string;
  text_content?: string;
  module_id?: number;
  lesson_order?: number;
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
  modules: Module[];
}
