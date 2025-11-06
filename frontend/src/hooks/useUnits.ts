import { useState, useEffect } from "react";
import api from "../api.ts";
import { Unit } from "../types.ts";

export const useUnits = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUnits = async () => {
      try {
        const response = await api.get("/api/units");
        setUnits(response.data);
        setLoading(false);
      } catch (err) {
        setError("Erro ao carregar unidades");
        setLoading(false);
      }
    };

    fetchUnits();
  }, []);

  // Helper function to get unit name by ID
  const getUnitNameById = (id: number | null | undefined) => {
    if (!id) return "Não informado";
    const unit = units.find((u) => u.id === id);
    return unit?.name || "Não informado";
  };

  // Helper function to get unit ID by name (for legacy support)
  const getUnitIdByName = (name: string | null | undefined) => {
    if (!name) return null;
    const unit = units.find((u) => u.name === name);
    return unit?.id || null;
  };

  return {
    units,
    loading,
    error,
    getUnitNameById,
    getUnitIdByName,
  };
};
