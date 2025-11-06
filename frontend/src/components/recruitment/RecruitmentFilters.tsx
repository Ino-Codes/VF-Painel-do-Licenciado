import React from "react";

interface Stage {
  id: number;
  name: string;
}

interface Filter {
  search: string;
  stage_id: string;
  role_applied_for: string;
  status: string;
}

interface RecruitmentFiltersProps {
  filters: Filter;
  onFilterChange: (filters: Partial<Filter>) => void;
  stages: Stage[];
}

const RecruitmentFilters: React.FC<RecruitmentFiltersProps> = ({
  filters,
  onFilterChange,
  stages,
}) => {
  return (
    <div className="recruitment-filters">
      <div className="filter-group">
        <input
          type="text"
          placeholder="Buscar candidato..."
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="form-input"
        />
      </div>

      <div className="filter-group">
        <input
          type="text"
          placeholder="Filtrar por cargo..."
          value={filters.role_applied_for}
          onChange={(e) => onFilterChange({ role_applied_for: e.target.value })}
          className="form-input"
        />
      </div>

      <div className="filter-group">
        <select
          value={filters.stage_id}
          onChange={(e) => onFilterChange({ stage_id: e.target.value })}
          className="form-select"
        >
          <option value="">Todas as etapas</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value })}
          className="form-select"
        >
          <option value="">Todos os status</option>
          <option value="Ativo">Ativo</option>
          <option value="Inativo">Inativo</option>
        </select>
      </div>
    </div>
  );
};

export default RecruitmentFilters;
