import React from "react";
import { useAuth } from "../../context/AuthContext.tsx";

// Opções do filtro de empresa usado nas telas de conteúdo. "all" = todas.
export const COMPANY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todas as empresas" },
  { value: "v-tax", label: "V-TAX" },
  { value: "v-banking", label: "V-BANKING" },
  { value: "v-business", label: "V-BUSINESS" },
  { value: "v-corp", label: "V-CORP" },
  { value: "v-tech", label: "V-TECH" },
  { value: "v-partner", label: "V-PARTNER" },
];

interface CompanyFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const CompanyFilter: React.FC<CompanyFilterProps> = ({ value, onChange }) => {
  const { hasPermission } = useAuth();
  const isInternal = hasPermission("internal_access");

  // Licenciado acessa apenas a V-PARTNER → sem filtro (empresa única).
  if (!isInternal) return null;

  return (
    <div
      className="company-filter"
      role="group"
      aria-label="Filtrar por empresa"
    >
      {COMPANY_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`company-filter-btn${
            value === opt.value ? " company-filter-btn--active" : ""
          }`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default CompanyFilter;
