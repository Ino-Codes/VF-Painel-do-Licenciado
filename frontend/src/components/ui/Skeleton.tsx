import React from "react";

interface SkeletonProps {
  className?: string;
  /** Largura CSS (ex.: "80%", "120px"). Padrão: 100%. */
  width?: string;
  /** Altura CSS (ex.: "1rem", "160px"). Padrão: 1rem. */
  height?: string;
  /** Bolinha (avatar). */
  circle?: boolean;
}

// Bloco base de "esqueleto" com brilho animado. Dimensões dinâmicas vão por
// CSS var (padrão sancionado do projeto), sem inline-style estático.
export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  width,
  height,
  circle = false,
}) => (
  <span
    className={`skeleton ${circle ? "skeleton--circle" : ""} ${className}`}
    style={
      {
        ...(width ? { "--sk-w": width } : {}),
        ...(height ? { "--sk-h": height } : {}),
      } as React.CSSProperties
    }
    aria-hidden="true"
  />
);

// ── Presets por contexto ────────────────────────────────────────────────────

// Card de curso (thumbnail + textos), espelhando o CourseCard.
const CourseCardSkeleton: React.FC = () => (
  <div className="course-card-skeleton">
    <Skeleton className="skeleton--thumb" />
    <div className="course-card-skeleton-body">
      <Skeleton width="40%" height="0.75rem" />
      <Skeleton width="85%" height="1.1rem" />
      <Skeleton width="100%" height="0.75rem" />
      <Skeleton width="60%" height="0.75rem" />
    </div>
  </div>
);

// Grade de cursos em carregamento (ex.: catálogo de Cursos).
export const CoursesGridSkeleton: React.FC<{ count?: number }> = ({
  count = 6,
}) => (
  <div className="courses-grid" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <CourseCardSkeleton key={i} />
    ))}
  </div>
);

// Painel de gráfico + lista lateral (ex.: Dashboard do Eneagrama).
export const ChartSkeleton: React.FC = () => (
  <div className="stats-container" aria-busy="true">
    <div className="stats-main-column">
      <Skeleton width="45%" height="1.1rem" />
      <Skeleton className="skeleton--chart" />
      <Skeleton width="35%" height="1.1rem" />
      <Skeleton className="skeleton--stat-card" />
    </div>
    <div className="stats-side-column">
      <Skeleton width="55%" height="1.1rem" />
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} height="1.75rem" />
      ))}
    </div>
  </div>
);

export default Skeleton;
