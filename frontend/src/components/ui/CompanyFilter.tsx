import React from "react";

// Opções do filtro de empresa usado nas telas de conteúdo. "all" = todas.
export const COMPANY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todas as empresas" },
  { value: "v-tax", label: "V-TAX" },
  { value: "v-banking", label: "V-BANKING" },
  { value: "v-business", label: "V-BUSINESS" },
  { value: "v-corp", label: "V-CORP" },
  { value: "v-tech", label: "V-TECH" },
];

interface CompanyFilterProps {
  value: string;
  onChange: (value: string) => void;
}

const CompanyFilter: React.FC<CompanyFilterProps> = ({ value, onChange }) => (
  <div className="company-filter" role="group" aria-label="Filtrar por empresa">
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

export default CompanyFilter;
