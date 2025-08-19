// Este arquivo centraliza as definições de tipo para o Módulo de Estudos

export interface Lesson {
  id: number;
  title: string;
  content_type: "video" | "text";
  content_data: string;
}

export interface Module {
  id: number;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: number;
  title: string;
  modules: Module[];
}
